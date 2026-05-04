import { NextResponse } from "next/server";
import { processDueViewerTrials } from "@/lib/payments/subscription-billing";

function isAuthorized(req: Request) {
  const expected = process.env.SUBSCRIPTION_BILLING_CRON_TOKEN?.trim();
  if (!expected) return true;
  const header = req.headers.get("x-cron-token")?.trim();
  return header === expected;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await processDueViewerTrials();
  return NextResponse.json({ ok: true, ...result });
}
