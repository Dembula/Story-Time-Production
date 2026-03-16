import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureCrewAccess(projectId: string) {
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

// List crew needs for the project with basic invitation counts
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCrewAccess(projectId);
  if (access.error) return access.error;

  const needs = await prisma.crewRoleNeed.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      invitations: true,
    },
  });

  return NextResponse.json({
    needs: needs.map((n) => ({
      id: n.id,
      department: n.department,
      role: n.role,
      seniority: n.seniority,
      notes: n.notes,
      invitationsCount: n.invitations.length,
    })),
  });
}

// Create a new crew role need
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCrewAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        department?: string | null;
        role: string;
        seniority?: string | null;
        notes?: string | null;
      }
    | null;

  if (!body?.role) {
    return NextResponse.json({ error: "Missing role" }, { status: 400 });
  }

  const need = await prisma.crewRoleNeed.create({
    data: {
      projectId,
      department: body.department ?? null,
      role: body.role,
      seniority: body.seniority ?? null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ need }, { status: 201 });
}

// Update an existing crew role need
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCrewAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        department?: string | null;
        role?: string;
        seniority?: string | null;
        notes?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const need = await prisma.crewRoleNeed.update({
    where: { id: body.id },
    data: {
      ...(body.department !== undefined ? { department: body.department } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.seniority !== undefined ? { seniority: body.seniority } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  return NextResponse.json({ need });
}

