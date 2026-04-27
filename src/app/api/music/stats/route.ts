import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMusicCreatorSyncStatsPayload } from "@/lib/financial-ledger";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "MUSIC_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let musicCreatorId = session.user.id;
  if (role === "ADMIN") {
    const param = request.nextUrl.searchParams.get("creatorId");
    if (param) musicCreatorId = param;
  }

  const payload = await getMusicCreatorSyncStatsPayload(musicCreatorId);
  return NextResponse.json(payload);
}
