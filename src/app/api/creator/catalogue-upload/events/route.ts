import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notifyUser } from "@/lib/notify-user";

const ALLOWED_TYPES = new Set(["CONTENT_UPLOAD_COMPLETE", "CONTENT_UPLOAD_FAILED"]);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    title?: string;
    body?: string;
    contentId?: string | null;
    url?: string;
  };

  if (!body.type || !ALLOWED_TYPES.has(body.type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const metadata: Record<string, unknown> = {};
  if (body.contentId) metadata.contentId = body.contentId;
  if (body.url) metadata.url = body.url;

  await notifyUser({
    userId,
    type: body.type,
    title: body.title.trim(),
    body: body.body.trim(),
    metadata,
  });

  return NextResponse.json({ ok: true });
}
