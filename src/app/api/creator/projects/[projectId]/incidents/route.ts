import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureIncidentAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureIncidentAccess(projectId);
  if (access.error) return access.error;

  const incidents = await prisma.incidentReport.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ incidents });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureIncidentAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        title: string;
        description: string;
        severity?: string;
        shootDayId?: string;
        location?: string;
      }
    | null;

  if (!body?.title || !body.description) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const incident = await prisma.incidentReport.create({
    data: {
      projectId,
      shootDayId: body.shootDayId ?? null,
      title: body.title,
      description: body.description,
      severity: body.severity ?? "LOW",
      location: body.location ?? null,
      createdById: userId,
    },
  });

  return NextResponse.json({ incident }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureIncidentAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        resolved?: boolean;
        severity?: string;
        location?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updated = await prisma.incidentReport.update({
    where: { id: body.id },
    data: {
      ...(body.resolved !== undefined
        ? { resolved: body.resolved, resolvedAt: body.resolved ? new Date() : null }
        : {}),
      ...(body.severity !== undefined ? { severity: body.severity } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
    },
  });

  return NextResponse.json({ incident: updated });
}

