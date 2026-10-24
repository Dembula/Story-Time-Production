import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCreatorIndustryNews } from "@/lib/creator-industry-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const payload = await getCreatorIndustryNews({ forceRefresh });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("[creator/industry-news GET]", err);
    return NextResponse.json({ error: "Failed to load industry news." }, { status: 502 });
  }
}
