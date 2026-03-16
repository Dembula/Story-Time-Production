import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createIdeaForUser,
  listIdeasForUser,
  updateIdeaForUser,
} from "@/lib/ideaStore";

interface Params {
  params: { projectId: string };
}

async function ensureIdeaAccess(projectId: string) {
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

  return { error: null as NextResponse | null, userId, project };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureIdeaAccess(params.projectId);
  if (access.error) return access.error;

  const ideas = await listIdeasForUser(access.userId!, params.projectId);

  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await ensureIdeaAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        logline?: string;
        notes?: string;
        genres?: string;
      }
    | null;

  if (!body?.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const idea = await createIdeaForUser({
    userId: access.userId!,
    projectId: params.projectId,
    title: body.title,
    logline: body.logline ?? null,
    notes: body.notes ?? null,
    genres: body.genres ?? null,
  });

  return NextResponse.json({ idea }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await ensureIdeaAccess(params.projectId);
  if (access.error) return access.error;
  const { project } = access;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        title?: string;
        logline?: string | null;
        notes?: string | null;
        genres?: string | null;
        convertedToProject?: boolean;
        syncToProjectMeta?: boolean;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const idea = await updateIdeaForUser({
    userId: access.userId!,
    id: body.id,
    projectId: params.projectId,
    title: body.title,
    logline: body.logline,
    notes: body.notes,
    genres: body.genres,
    convertedToProject: body.convertedToProject,
  });

  if (!idea) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.syncToProjectMeta) {
    await prisma.originalProject.update({
      where: { id: project.id },
      data: {
        title: body.title ?? project.title,
        logline: body.logline ?? project.logline,
        genre: body.genres ?? project.genre,
      },
    });
  }

  return NextResponse.json({ idea });
}

