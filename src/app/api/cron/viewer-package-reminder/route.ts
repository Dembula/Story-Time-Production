import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronCall } from "@/lib/cron-auth";
import { processDueViewerPackageReminders } from "@/lib/emails/viewer-package-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Morning SAST (~07:00): send one package reminder to viewers who signed up
 * exactly 2 calendar days ago and still have not chosen/paid for a package.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueViewerPackageReminders(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/viewer-package-reminder] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reminder cron failed" },
      { status: 500 },
    );
  }
}
