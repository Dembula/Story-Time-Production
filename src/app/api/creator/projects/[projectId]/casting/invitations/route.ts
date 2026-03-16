import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ projectId: string }>;
}

async function ensureCreatorForProject(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId, project };
}

// List invitations for this project (creator view)
export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureCreatorForProject(projectId);
  if (access.error) return access.error;

  const invitations = await prisma.castingInvitation.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      role: { select: { id: true, name: true } },
      castingAgency: { select: { id: true, agencyName: true } },
      talent: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    invitations.map((i) => ({
      id: i.id,
      status: i.status,
      message: i.message,
      createdAt: i.createdAt,
      role: i.role,
      castingAgency: i.castingAgency,
      talent: i.talent,
    }))
  );
}

// Create an invitation from creator to casting agency / talent for a specific role
export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureCreatorForProject(projectId);
  if (access.error) return access.error;
  const creatorId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        roleId: string;
        castingAgencyId?: string | null;
        talentId?: string | null;
        message?: string | null;
      }
    | null;

  if (!body?.roleId) {
    return NextResponse.json({ error: "Missing roleId" }, { status: 400 });
  }

  // Ensure role belongs to this project
  const role = await prisma.castingRole.findFirst({
    where: { id: body.roleId, projectId },
  });
  if (!role) {
    return NextResponse.json({ error: "Role not found for project" }, { status: 404 });
  }

  const invitation = await prisma.castingInvitation.create({
    data: {
      projectId,
      roleId: body.roleId,
      creatorId,
      castingAgencyId: body.castingAgencyId ?? null,
      talentId: body.talentId ?? null,
      message: body.message ?? null,
    },
    include: {
      role: { select: { id: true, name: true } },
      castingAgency: { select: { id: true, agencyName: true } },
      talent: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(invitation, { status: 201 });
}

