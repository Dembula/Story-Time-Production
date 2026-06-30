import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { backfillCrewMemberCreditPeople } from "@/lib/credit-person";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 500) : 200;

  const result = await backfillCrewMemberCreditPeople(limit);
  return NextResponse.json({ ok: true, ...result });
}
