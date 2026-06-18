import { NextResponse } from "next/server";
import { GET as runSubscriptionBillingCron } from "@/app/api/cron/subscription-billing/route";

/** Legacy path — forwards to /api/cron/subscription-billing */
export async function GET(req: Request) {
  return runSubscriptionBillingCron(req as Parameters<typeof runSubscriptionBillingCron>[0]);
}

export async function POST(req: Request) {
  return GET(req);
}
