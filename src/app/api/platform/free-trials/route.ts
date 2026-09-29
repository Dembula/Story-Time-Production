import { NextResponse } from "next/server";
import { isFreeTrialsEnabled } from "@/lib/payments/free-trial-settings";

export const dynamic = "force-dynamic";

/** Public flag for onboarding UIs — whether new free trials may be offered. */
export async function GET() {
  const enabled = await isFreeTrialsEnabled();
  return NextResponse.json({
    freeTrialsEnabled: enabled,
  });
}
