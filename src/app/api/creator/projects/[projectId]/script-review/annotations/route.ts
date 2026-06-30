import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { ensureReviewProjectAccess } from "@/lib/script-review/access";

import { canUseLayer } from "@/lib/script-review/permissions";

import type { ReviewLayerId } from "@/lib/script-review/types";



type RouteParams = { params: Promise<{ projectId: string }> };



export async function POST(req: NextRequest, { params }: RouteParams) {

  const { projectId } = await params;

  const gate = await ensureReviewProjectAccess(projectId);

  if (gate.error || !gate.access) return gate.error;



  const body = (await req.json().catch(() => null)) as {

    sessionId?: string;

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



  if (!body?.sessionId || !body?.type) {

    return NextResponse.json({ error: "sessionId and type required" }, { status: 400 });

  }



  const layer = (body.layer ?? "producer") as ReviewLayerId;

  const isReply = Boolean(body.parentId);



  if (!gate.access.permissions.canAnnotate && !isReply) {

    return NextResponse.json({ error: "Read-only access" }, { status: 403 });

  }

  if (isReply && !gate.access.permissions.canReply) {

    return NextResponse.json({ error: "Cannot reply" }, { status: 403 });

  }

  if (!isReply && !canUseLayer(gate.access.permissions.mode, layer)) {

    return NextResponse.json({ error: "Layer not permitted for your role" }, { status: 403 });

  }



  const session = await prisma.scriptReviewSession.findFirst({

    where: { id: body.sessionId, projectId },

  });

  if (!session) {

    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  }



  const annotation = await prisma.scriptReviewAnnotation.create({

    data: {

      sessionId: body.sessionId,

      authorId: gate.userId!,

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



  return NextResponse.json({ annotation }, { status: 201 });

}



export async function PATCH(req: NextRequest, { params }: RouteParams) {

  const { projectId } = await params;

  const gate = await ensureReviewProjectAccess(projectId);

  if (gate.error || !gate.access) return gate.error;



  const body = (await req.json().catch(() => null)) as {

    id?: string;

    resolved?: boolean;

    status?: string;

    body?: string;

  } | null;



  if (!body?.id) {

    return NextResponse.json({ error: "id required" }, { status: 400 });

  }



  const existing = await prisma.scriptReviewAnnotation.findFirst({

    where: { id: body.id, session: { projectId } },

  });

  if (!existing) {

    return NextResponse.json({ error: "Not found" }, { status: 404 });

  }



  const editingBody = body.body !== undefined && body.body !== existing.body;

  if (editingBody && existing.authorId !== gate.userId && !gate.access.isAdmin) {

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  }



  const annotation = await prisma.scriptReviewAnnotation.update({

    where: { id: body.id },

    data: {

      ...(body.resolved !== undefined ? { resolved: body.resolved } : {}),

      ...(body.status ? { status: body.status } : {}),

      ...(body.body !== undefined ? { body: body.body } : {}),

    },

  });



  return NextResponse.json({ annotation });

}



export async function DELETE(req: NextRequest, { params }: RouteParams) {

  const { projectId } = await params;

  const gate = await ensureReviewProjectAccess(projectId);

  if (gate.error) return gate.error;



  const id = req.nextUrl.searchParams.get("id");

  if (!id) {

    return NextResponse.json({ error: "id required" }, { status: 400 });

  }



  const existing = await prisma.scriptReviewAnnotation.findFirst({

    where: { id, session: { projectId } },

  });

  if (!existing) {

    return NextResponse.json({ error: "Not found" }, { status: 404 });

  }



  if (existing.authorId !== gate.userId && !gate.access?.isAdmin) {

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  }



  await prisma.scriptReviewAnnotation.delete({ where: { id } });

  return NextResponse.json({ ok: true });

}


