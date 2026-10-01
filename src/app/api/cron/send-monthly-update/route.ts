import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronCall } from "@/lib/cron-auth";

/**
 * Monthly platform update emails are admin-triggered only
 * (`POST /api/admin/monthly-update` from the admin overview button).
 * This cron path is retained as a no-op so stale schedules cannot mass-mail.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "monthly_update_manual_only",
    message:
      "Monthly update emails are not sent automatically. Use Admin → Platform Overview → Send monthly update to all users.",
  });
}
