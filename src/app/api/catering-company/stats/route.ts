import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_PAYEE_SETTLED_REPORTING, MARKETPLACE_TRANSACTION_TYPE, sumPayeeCompletedAmount } from "@/lib/financial-ledger";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const revenue = await sumPayeeCompletedAmount(user.id, MARKETPLACE_TRANSACTION_TYPE.CATERING_BOOKING);

  return NextResponse.json({
    revenue,
    reporting: MARKETPLACE_PAYEE_SETTLED_REPORTING,
  });
}
