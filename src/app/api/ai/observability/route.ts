import { NextResponse } from "next/server";
import { getAiObservabilitySummary } from "@/lib/ai-os/observability/log-request";

/** AI observability summary for admin/debug (requires CRON_SECRET or dev). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && (!cronSecret || auth !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const summary = await getAiObservabilitySummary(since);
  return NextResponse.json({ since: since.toISOString(), ...summary });
}
