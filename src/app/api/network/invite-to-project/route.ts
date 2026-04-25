import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    projectId?: string;
    inviteeUserId?: string;
    role?: string;
    department?: string | null;
  } | null;

  const projectId = body?.projectId?.trim();
  const inviteeUserId = body?.inviteeUserId?.trim();
  if (!projectId || !inviteeUserId) {
    return NextResponse.json({ error: "projectId and inviteeUserId are required" }, { status: 400 });
  }
  if (inviteeUserId === userId) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  const invitee = await prisma.user.findUnique({ where: { id: inviteeUserId }, select: { id: true, name: true, email: true } });
  if (!invitee) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const activeMember = await prisma.originalMember.findFirst({
    where: { projectId, userId, status: "ACTIVE" },
  });
  const pitchOwner = await prisma.originalPitch.findFirst({
    where: { projectId, creatorId: userId },
    select: { id: true },
  });
  if (!activeMember && !pitchOwner) {
    return NextResponse.json({ error: "You can only invite from projects you belong to" }, { status: 403 });
  }

  const memberRole = (body?.role ?? "Collaborator").trim() || "Collaborator";
  const department = body?.department?.trim() || null;

  const member = await prisma.originalMember.upsert({
    where: { userId_projectId: { userId: inviteeUserId, projectId } },
    create: {
      userId: inviteeUserId,
      projectId,
      role: memberRole,
      department,
      status: "INVITED",
    },
    update: {
      role: memberRole,
      department,
      status: "INVITED",
    },
  });

  await notifyUser({
    userId: inviteeUserId,
    type: "PROJECT_COLLAB_INVITE",
    title: "Project collaboration invite",
    body: `${session.user?.name ?? "A creator"} invited you to join "${project.title}" as ${memberRole}. Open My Projects to accept or decline.`,
    metadata: {
      projectId,
      memberId: member.id,
      url: "/creator/dashboard",
    },
  });

  return NextResponse.json({ ok: true, member });
}
