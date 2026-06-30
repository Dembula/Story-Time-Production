import { NextResponse } from "next/server";
import { requireSessionUser, isFunderRole } from "@/lib/funders";
import { getFunderBloombergAnalytics } from "@/lib/stakeholder-ecosystem/funder-analytics-service";

export async function GET() {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!isFunderRole(access.role!)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const analytics = await getFunderBloombergAnalytics(access.userId!);
  return NextResponse.json({ analytics });
}