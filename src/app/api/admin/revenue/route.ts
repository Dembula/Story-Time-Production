import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAdminRevenueBundle } from "@/lib/admin-revenue-bundle";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await fetchAdminRevenueBundle();
  const { periodStart: _ps, periodEnd: _pe, ...rest } = body;
  return NextResponse.json(rest);
}
