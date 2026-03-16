import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureCastingAccess(projectId: string) {
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

// List casting roles for this project with basic invitation counts
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCastingAccess(projectId);
  if (access.error) return access.error;

  const roles = await prisma.castingRole.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      invitations: true,
      breakdownCharacter: true,
    },
  });

  return NextResponse.json({
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      breakdownCharacterId: r.breakdownCharacterId,
      invitationsCount: r.invitations.length,
      castInvitations: r.invitations.filter((i) => i.status === "ACCEPTED").length,
    })),
  });
}

// Create or update a casting role
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCastingAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        name: string;
        description?: string | null;
        breakdownCharacterId?: string | null;
      }
    | null;

  if (!body?.name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const role = await prisma.castingRole.create({
    data: {
      projectId,
      name: body.name,
      description: body.description ?? null,
      breakdownCharacterId: body.breakdownCharacterId ?? null,
    },
  });

  return NextResponse.json({ role }, { status: 201 });
}

// Lightweight updates for role status/description
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCastingAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        name?: string;
        description?: string | null;
        status?: string;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const role = await prisma.castingRole.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
  });

  return NextResponse.json({ role });
}

