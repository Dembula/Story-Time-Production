import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import {
  durationLabel,
  expiresAtForDuration,
  guestInvitePath,
  isStoryboardGuestDurationKey,
  isStoryboardInviteActive,
  newStoryboardInviteToken,
  type StoryboardGuestDurationKey,
} from "@/lib/storyboard/guest-access";

const db = prisma as any;

type RouteCtx = { params: Promise<{ projectId: string; boardId: string }> };

function absoluteInviteUrl(token: string, req: NextRequest): string {
  const path = guestInvitePath(token);
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return `${base}${path}`;
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const board = await db.storyboardBoard.findFirst({
    where: { id: boardId, projectId },
    select: { id: true },
  });
  if (!board) return NextResponse.json({ error: "Board not found." }, { status: 404 });

  const invites = await db.storyboardGuestInvite.findMany({
    where: { boardId, projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    invites: invites.map(
      (invite: {
        id: string;
        token: string;
        email: string | null;
        durationKey: string;
        expiresAt: Date | null;
        revokedAt: Date | null;
        createdAt: Date;
      }) => ({
        id: invite.id,
        url: absoluteInviteUrl(invite.token, req),
        email: invite.email,
        durationKey: invite.durationKey,
        durationLabel: durationLabel(invite.durationKey),
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        revokedAt: invite.revokedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
        active: isStoryboardInviteActive(invite),
      }),
    ),
  });
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const board = await db.storyboardBoard.findFirst({
    where: { id: boardId, projectId },
    select: { id: true, title: true },
  });
  if (!board) return NextResponse.json({ error: "Board not found." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { durationKey?: string; email?: string; sendEmail?: boolean }
    | null;

  if (!body?.durationKey || !isStoryboardGuestDurationKey(body.durationKey)) {
    return NextResponse.json({ error: "Valid durationKey is required." }, { status: 400 });
  }

  const durationKey = body.durationKey as StoryboardGuestDurationKey;
  const token = newStoryboardInviteToken();
  const invite = await db.storyboardGuestInvite.create({
    data: {
      boardId,
      projectId,
      createdById: access.userId,
      token,
      email: body.email?.trim() || null,
      durationKey,
      expiresAt: expiresAtForDuration(durationKey),
    },
  });

  // Email send is best-effort; link always works.
  let emailSent = false;
  if (body.sendEmail && invite.email) {
    try {
      const { sendTransactionalEmail } = await import("@/lib/email");
      await sendTransactionalEmail({
        to: invite.email,
        subject: `Storyboard invite: ${board.title}`,
        html: `<p>You've been invited to view a Story Time storyboard.</p><p><a href="${absoluteInviteUrl(token, req)}">Open storyboard</a></p><p>Access: ${durationLabel(durationKey)}</p>`,
        text: `View storyboard: ${absoluteInviteUrl(token, req)} (${durationLabel(durationKey)})`,
      });
      emailSent = true;
    } catch (e) {
      console.warn("[storyboard] invite email failed", e);
    }
  }

  return NextResponse.json({
    invite: {
      id: invite.id,
      url: absoluteInviteUrl(token, req),
      email: invite.email,
      durationKey: invite.durationKey,
      durationLabel: durationLabel(invite.durationKey),
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      revokedAt: null,
      createdAt: invite.createdAt.toISOString(),
      active: true,
    },
    emailSent,
  });
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const inviteId = req.nextUrl.searchParams.get("inviteId");
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId is required." }, { status: 400 });
  }

  const invite = await db.storyboardGuestInvite.findFirst({
    where: { id: inviteId, boardId, projectId },
    select: { id: true },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found." }, { status: 404 });

  await db.storyboardGuestInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
