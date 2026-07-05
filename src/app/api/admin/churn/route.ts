import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminChurnTelemetry } from "@/lib/admin/churn-telemetry";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await getAdminChurnTelemetry();
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "P2021") {
      return NextResponse.json({
        migrationRequired: true,
        metrics: {},
        cancelledSubscriptions: [],
        cancelledTransactions: [],
      });
    }
    throw error;
  }
}
