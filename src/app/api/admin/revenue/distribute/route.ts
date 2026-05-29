import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  distributeCreatorPoolForPeriod,
  getCalendarMonthRange,
  getPreviousCalendarMonthRange,
} from "@/lib/payments/creator-pool-distribution";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { period?: string } | null;
  let periodStart: Date;
  let periodEnd: Date;

  if (body?.period && /^\d{4}-\d{2}$/.test(body.period)) {
    const [yearRaw, monthRaw] = body.period.split("-");
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return NextResponse.json({ error: "Invalid period. Use YYYY-MM." }, { status: 400 });
    }
    ({ periodStart, periodEnd } = getCalendarMonthRange(year, monthIndex));
  } else {
    ({ periodStart, periodEnd } = getPreviousCalendarMonthRange());
  }

  const result = await distributeCreatorPoolForPeriod(periodStart, periodEnd);
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result);
}
