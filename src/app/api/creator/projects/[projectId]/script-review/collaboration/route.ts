import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { displayName } from "@/lib/script-studio/collaboration-access";

import { ensureReviewProjectAccess } from "@/lib/script-review/access";

import {

  listReviewPeers,

  reviewPeerColor,

  upsertReviewPeer,

} from "@/lib/script-review/collaboration-room";



type RouteParams = { params: Promise<{ projectId: string }> };



export async function GET(req: NextRequest, { params }: RouteParams) {

  const { projectId } = await params;

  const gate = await ensureReviewProjectAccess(projectId);

  if (gate.error) return gate.error;



  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {

    return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  }



  const peers = await listReviewPeers(sessionId, gate.userId ?? undefined);

  return NextResponse.json({ peers, myColor: reviewPeerColor(gate.userId!) });

}



export async function POST(req: NextRequest, { params }: RouteParams) {

  const { projectId } = await params;

  const gate = await ensureReviewProjectAccess(projectId);

  if (gate.error) return gate.error;



  const body = (await req.json().catch(() => null)) as {

    sessionId?: string;

    pageIndex?: number;

    lineIndex?: number | null;

    cursorX?: number | null;

    cursorY?: number | null;

    cursorChar?: number | null;

    isDrawing?: boolean;

    isTyping?: boolean;

    tool?: string;

    displayName?: string;

    image?: string | null;

  } | null;



  if (!body?.sessionId) {

    return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  }



  const user = await prisma.user.findUnique({

    where: { id: gate.userId! },

    select: { name: true, professionalName: true, email: true, image: true },

  });



  const peers = await upsertReviewPeer(body.sessionId, {

    userId: gate.userId!,

    displayName: body.displayName?.trim() || (user ? displayName(user) : "Reviewer"),

    image: body.image ?? user?.image ?? null,

    color: reviewPeerColor(gate.userId!),

    pageIndex: body.pageIndex ?? 0,

    lineIndex: body.lineIndex ?? null,

    cursorX: body.cursorX ?? null,

    cursorY: body.cursorY ?? null,

    cursorChar: body.cursorChar ?? null,

    isDrawing: Boolean(body.isDrawing),

    isTyping: Boolean(body.isTyping),

    tool: body.tool ?? null,

  });



  return NextResponse.json({

    peers: peers.filter((p) => p.userId !== gate.userId),

  });

}


