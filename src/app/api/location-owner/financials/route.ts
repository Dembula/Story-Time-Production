import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocationOwnerFinancialSnapshot } from "@/lib/financial-ledger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "LOCATION_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getLocationOwnerFinancialSnapshot(user.id);
  return NextResponse.json(snapshot);
}
