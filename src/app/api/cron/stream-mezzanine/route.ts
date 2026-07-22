import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronCall } from "@/lib/cron-auth";
import { advanceAllMezzanineJobs } from "@/lib/stream-encode-pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Poll MediaConvert mezzanine jobs and ingest completed outputs into Cloudflare Stream. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await advanceAllMezzanineJobs(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("mezzanine cron failed:", err);
    return NextResponse.json({ error: "Mezzanine poll failed" }, { status: 500 });
  }
}
