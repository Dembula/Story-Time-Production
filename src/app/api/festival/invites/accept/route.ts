import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptFestivalTeamInvite } from "@/lib/festival/invites";
import { ensureUserRole } from "@/lib/user-roles";
import { persistActivePlatformRole } from "@/lib/platform-roles";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await ensureUserRole(userId, "FESTIVAL_CURATOR");
  const result = await acceptFestivalTeamInvite({ token, userId, userEmail: email });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Persist active portal so middleware JWT switch lands on festival, not the prior role.
  await persistActivePlatformRole(userId, "FESTIVAL_CURATOR");

  const callbackUrl = `/festival/festivals/${result.festivalId}`;
  return NextResponse.json({
    ok: true,
    festivalId: result.festivalId,
    festivalName: result.festivalName,
    redirectTo: `/auth/switch-role?role=FESTIVAL_CURATOR&callbackUrl=${encodeURIComponent(callbackUrl)}`,
  });
}
