import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptStudioTeamInviteForUser } from "@/lib/creator-studio-team-invite-accept";
import { linkPendingStudioInvitesToUser } from "@/lib/creator-studio-company";

/** Accept or decline a studio team invite by token (signed-in invitee). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const email = session?.user?.email;
  if (!userId || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    token?: string;
    action?: string;
  } | null;

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 });

  const action = body?.action === "decline" ? "decline" : "accept";

  await linkPendingStudioInvitesToUser(userId, email);

  const result = await acceptStudioTeamInviteForUser({
    userId,
    email,
    displayName: session?.user?.name,
    token,
    action,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    profileId: result.profileId,
    companyId: result.companyId,
  });
}
