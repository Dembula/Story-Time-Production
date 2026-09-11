import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: "Missing invite token" }, { status: 400 });
  }

  const invite = await prisma.projectCollaboratorInvite.findUnique({
    where: { token },
    select: {
      id: true,
      emailNorm: true,
      status: true,
      expiresAt: true,
      role: true,
      personalMessage: true,
      project: { select: { id: true, title: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ valid: false, error: "Invite not found" }, { status: 404 });
  }

  const expired = invite.expiresAt.getTime() < Date.now();
  if (expired && invite.status === "PENDING") {
    await prisma.projectCollaboratorInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
  }

  const status = expired && invite.status === "PENDING" ? "EXPIRED" : invite.status;
  const valid = status === "PENDING" || status === "ACCEPTED";
  return NextResponse.json({
    valid,
    expired: status === "EXPIRED",
    status,
    emailNorm: invite.emailNorm,
    role: invite.role,
    personalMessage: invite.personalMessage,
    projectId: invite.project.id,
    projectTitle: invite.project.title,
    invitedByName: invite.invitedBy.name ?? invite.invitedBy.email ?? "A creator",
  });
}
