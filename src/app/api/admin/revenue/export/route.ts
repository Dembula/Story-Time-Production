import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAdminRevenueBundle } from "@/lib/admin-revenue-bundle";
import { adminRevenueBundleToCsv } from "@/lib/admin-revenue-csv";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bundle = await fetchAdminRevenueBundle();
  const csv = adminRevenueBundleToCsv(bundle);
  const filename = `admin-revenue-${bundle.periodStart.toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
