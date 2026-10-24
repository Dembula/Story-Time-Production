import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractArticleBody } from "@/lib/creator-industry-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const extracted = await extractArticleBody(url);
  if (!extracted.ok) {
    return NextResponse.json(extracted, { status: 422 });
  }
  return NextResponse.json(extracted);
}
