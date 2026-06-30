import { NextRequest, NextResponse } from "next/server";
import {
  displayName,
  ensureScriptAccess,
  listProjectCollaborators,
} from "@/lib/script-studio/collaboration-access";
import {
  listScriptPeers,
  peerColorForUser,
  removeScriptPeer,
  upsertScriptPeer,
} from "@/lib/script-studio/collaboration-room";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type RouteParams = { params: Promise<{ scriptId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;

  const { access } = gate;
  const peers = await listScriptPeers(scriptId, access.userId);
  const collaborators = access.script.projectId
    ? await listProjectCollaborators(access.script.projectId)
    : [];

  const session = await getServerSession(authOptions);
  const me = session?.user as { name?: string; image?: string } | undefined;

  return NextResponse.json({
    peers,
    collaborators,
    scriptUpdatedAt: access.script.updatedAt.toISOString(),
    scriptOwnerId: access.script.userId,
    canWrite: access.canWrite,
    collaborationMode: access.collaborationMode,
    memberRole: access.memberRole,
    myColor: peerColorForUser(access.userId),
    me: {
      userId: access.userId,
      displayName: displayName({
        professionalName: null,
        name: me?.name ?? null,
        email: null,
      }),
      image: me?.image ?? null,
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;

  const { access } = gate;
  const body = (await req.json().catch(() => null)) as {
    action?: "heartbeat" | "leave";
    displayName?: string;
    image?: string | null;
    mode?: "writer" | "producer" | "read_only";
    cursorLine?: number;
    cursorCol?: number;
    selectionStart?: number;
    selectionEnd?: number;
    isTyping?: boolean;
    isWriting?: boolean;
    activeSceneHeading?: string | null;
  } | null;

  if (body?.action === "leave") {
    await removeScriptPeer(scriptId, access.userId);
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: access.userId },
    select: { name: true, professionalName: true, email: true, image: true },
  });

  const peers = await upsertScriptPeer(scriptId, {
    userId: access.userId,
    displayName:
      body?.displayName?.trim() ||
      (user ? displayName(user) : "Creator"),
    image: body?.image ?? user?.image ?? null,
    color: peerColorForUser(access.userId),
    mode: body?.mode ?? access.collaborationMode,
    cursorLine: body?.cursorLine ?? 0,
    cursorCol: body?.cursorCol ?? 0,
    selectionStart: body?.selectionStart ?? 0,
    selectionEnd: body?.selectionEnd ?? 0,
    isTyping: Boolean(body?.isTyping),
    isWriting: Boolean(body?.isWriting),
    activeSceneHeading: body?.activeSceneHeading ?? null,
  });

  return NextResponse.json({
    ok: true,
    peers: peers.filter((p) => p.userId !== access.userId),
    scriptUpdatedAt: access.script.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;
  await removeScriptPeer(scriptId, gate.access.userId);
  return NextResponse.json({ ok: true });
}
