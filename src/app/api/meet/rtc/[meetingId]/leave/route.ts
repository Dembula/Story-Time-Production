import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMeetRtcIdentity } from "@/lib/meet/access";
import { leaveMeetAsGuest, leaveMeetAsUser } from "@/lib/meet/join";
import { MEET_GUEST_COOKIE, meetGuestCookieOptions } from "@/lib/meet/guest-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await ctx.params;
  const identity = await resolveMeetRtcIdentity(meetingId);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (identity.kind === "user") {
    await leaveMeetAsUser(meetingId, identity.userId);
  } else {
    await leaveMeetAsGuest(identity.guestId);
  }

  await prisma.meetSignal.create({
    data: {
      meetingId,
      fromPeer: identity.peerId,
      toPeer: "*",
      type: "peer-leave",
      payload: { peerId: identity.peerId },
    },
  });

  const res = NextResponse.json({ ok: true });
  if (identity.kind === "guest") {
    res.cookies.set(MEET_GUEST_COOKIE, "", { ...meetGuestCookieOptions(0), maxAge: 0 });
  }
  return res;
}
