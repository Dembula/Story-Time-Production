import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
      role: null as string | null,
    };
  }

  if (role === "ADMIN") {
    return { error: null as NextResponse | null, userId, role };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
      role: null as string | null,
    };
  }

  const isCreatorMember =
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
      role: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId, role };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        reviewId: string;
        body: string;
        timestampMs?: number;
      }
    | null;

  if (!body?.reviewId || !body?.body?.trim()) {
    return NextResponse.json({ error: "Missing reviewId or body" }, { status: 400 });
  }

  const review = await prisma.postProductionReview.findFirst({
    where: { id: body.reviewId, projectId },
  });
  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const note = await prisma.reviewNote.create({
    data: {
      reviewId: body.reviewId,
      userId,
      body: body.body.trim(),
      timestampMs: body.timestampMs ?? null,
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const noteId =
    req.nextUrl.searchParams.get("noteId")?.trim() ||
    ((await req.json().catch(() => null)) as { noteId?: string } | null)?.noteId?.trim();

  if (!noteId) {
    return NextResponse.json({ error: "noteId is required" }, { status: 400 });
  }

  const note = await prisma.reviewNote.findFirst({
    where: {
      id: noteId,
      review: { projectId },
    },
  });
  if (!note) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Anyone with project access can remove review notes.
  await prisma.reviewNote.delete({ where: { id: note.id } });
  return NextResponse.json({ ok: true });
}
