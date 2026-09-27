import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveScriptReviewGuest } from "@/lib/script-review/guest-session";
import type { ReviewLayerId } from "@/lib/script-review/types";

export async function POST(req: NextRequest) {
  const guest = await getActiveScriptReviewGuest();
  if (!guest) {
    return NextResponse.json({ error: "Guest session required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    type?: string;
    layer?: string;
    pageIndex?: number;
    lineIndex?: number;
    anchorText?: string;
    body?: string;
    data?: Record<string, unknown>;
    priority?: string;
    parentId?: string;
  } | null;

  if (!body?.type) {
    return NextResponse.json({ error: "type required" }, { status: 400 });
  }

  const reviewSession = await prisma.scriptReviewSession.findFirst({
    where: { id: guest.reviewSessionId, projectId: guest.projectId },
    select: { id: true },
  });
  if (!reviewSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (body.parentId) {
    const parent = await prisma.scriptReviewAnnotation.findFirst({
      where: { id: body.parentId, sessionId: reviewSession.id },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent annotation not found" }, { status: 404 });
    }
  }

  const layer = (body.layer ?? "producer") as ReviewLayerId;

  const annotation = await prisma.scriptReviewAnnotation.create({
    data: {
      sessionId: reviewSession.id,
      authorId: null,
      guestName: guest.guestName,
      guestEmail: guest.guestEmail,
      type: body.type,
      layer,
      pageIndex: body.pageIndex ?? 0,
      lineIndex: body.lineIndex ?? null,
      anchorText: body.anchorText ?? null,
      body: body.body ?? null,
      data: body.data ? (body.data as object) : undefined,
      priority: body.priority ?? null,
      parentId: body.parentId ?? null,
    },
    include: {
      author: {
        select: { id: true, name: true, professionalName: true, image: true },
      },
    },
  });

  return NextResponse.json(
    {
      annotation: {
        ...annotation,
        createdAt: annotation.createdAt.toISOString(),
        data: (annotation.data as Record<string, unknown> | null) ?? null,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest) {
  const guest = await getActiveScriptReviewGuest();
  if (!guest) {
    return NextResponse.json({ error: "Guest session required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    resolved?: boolean;
    status?: string;
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.scriptReviewAnnotation.findFirst({
    where: {
      id: body.id,
      sessionId: guest.reviewSessionId,
      session: { projectId: guest.projectId },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const annotation = await prisma.scriptReviewAnnotation.update({
    where: { id: body.id },
    data: {
      ...(body.resolved !== undefined ? { resolved: body.resolved } : {}),
      ...(body.status ? { status: body.status } : {}),
    },
  });

  return NextResponse.json({
    annotation: {
      ...annotation,
      createdAt: annotation.createdAt.toISOString(),
    },
  });
}
