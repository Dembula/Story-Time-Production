import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  EDIT_REVIEW_GUEST_COOKIE,
  isInviteActive,
  newGuestSessionToken,
} from "@/lib/edit-review/guest-access";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await context.params;
  const inviteToken = decodeURIComponent(raw || "").trim();
  if (!inviteToken) {
    return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: string; email?: string }
    | null;

  const guestName = body?.name?.trim() || "";
  if (guestName.length < 2) {
    return NextResponse.json({ error: "Please enter your name (at least 2 characters)." }, { status: 400 });
  }
  const guestEmail = body?.email?.trim().toLowerCase() || null;
  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: "That email doesn’t look valid." }, { status: 400 });
  }

  const invite = await prisma.editReviewGuestInvite.findUnique({
    where: { token: inviteToken },
  });
  if (!invite || !isInviteActive(invite)) {
    return NextResponse.json(
      { error: "This invite is no longer available." },
      { status: 404 },
    );
  }

  const sessionToken = newGuestSessionToken();
  const session = await prisma.editReviewGuestSession.create({
    data: {
      inviteId: invite.id,
      token: sessionToken,
      guestName,
      guestEmail: guestEmail || invite.email,
      expiresAt: invite.expiresAt,
    },
  });

  const res = NextResponse.json({
    ok: true,
    guestName: session.guestName,
    expiresAt: session.expiresAt?.toISOString() ?? null,
  });

  const maxAge =
    invite.expiresAt != null
      ? Math.max(60, Math.floor((invite.expiresAt.getTime() - Date.now()) / 1000))
      : 60 * 60 * 24 * 365;

  res.cookies.set(EDIT_REVIEW_GUEST_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return res;
}
