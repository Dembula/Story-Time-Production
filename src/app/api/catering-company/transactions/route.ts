import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const transactions = await prisma.transaction.findMany({
    where: { payeeId: user.id, type: "CATERING_BOOKING", status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, amount: true, totalAmount: true, createdAt: true },
  });

  return NextResponse.json(transactions);
}
