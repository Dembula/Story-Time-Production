import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await prisma.transaction.aggregate({
    where: { payeeId: user.id, status: "COMPLETED", type: "CATERING_BOOKING" },
    _sum: { amount: true, feeAmount: true },
  });
  const revenue = result._sum.amount ?? 0;

  return NextResponse.json({ revenue });
}
