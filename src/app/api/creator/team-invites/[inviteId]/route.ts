import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptStudioTeamInviteForUser } from "@/lib/creator-studio-team-invite-accept";
import { linkPendingStudioInvitesToUser } from "@/lib/creator-studio-company";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ inviteId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const email = session?.user?.email;
  if (!userId || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { inviteId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action === "decline" ? "decline" : body?.action === "accept" ? "accept" : null;
  if (!action) return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });

  await linkPendingStudioInvitesToUser(userId, email);

  const result = await acceptStudioTeamInviteForUser({
    userId,
    email,
    displayName: session?.user?.name,
    inviteId,
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
