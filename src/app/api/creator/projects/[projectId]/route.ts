import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONFIRM_DELETE_PROJECT, parseDeleteConfirm } from "@/lib/confirm-delete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently delete a film project and cascaded workspace data.
 * Only the project owner (pitch creator) or an ADMIN may delete.
 * Body must include `{ confirm: "delete project" }` as a typed safeguard.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  const confirmGate = parseDeleteConfirm(body, CONFIRM_DELETE_PROJECT);
  if (!confirmGate.ok) {
    return NextResponse.json({ error: confirmGate.error }, { status: 400 });
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      pitches: {
        select: { id: true, creatorId: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const ownerId = project.pitches[0]?.creatorId ?? null;
  const isOwner = ownerId === userId;
  if (role !== "ADMIN" && !isOwner) {
    return NextResponse.json(
      { error: "Only the project owner can delete this project." },
      { status: 403 },
    );
  }

  try {
    // Detach optional SetNull links that can confuse catalogue / calendar UIs, then delete.
    await prisma.$transaction(async (tx) => {
      await tx.content.updateMany({
        where: { linkedProjectId: projectId },
        data: { linkedProjectId: null },
      });
      await tx.originalPitch.updateMany({
        where: { projectId },
        data: { projectId: null },
      });
      await tx.originalProject.delete({ where: { id: projectId } });
    });
  } catch (error) {
    console.error("delete project failed", error);
    return NextResponse.json(
      { error: "Could not delete project. Some related records may still be in use." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: projectId });
}
