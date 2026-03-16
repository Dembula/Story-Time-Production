import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const creatorId = session?.user?.id;
  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { bankName, accountNumber, accountType, branchCode } = body as { bankName?: string; accountNumber?: string; accountType?: string; branchCode?: string };

  if (!bankName || !accountNumber) {
    return NextResponse.json({ error: "Bank name and account number required" }, { status: 400 });
  }

  await prisma.creatorBanking.upsert({
    where: { userId: creatorId },
    create: {
      userId: creatorId,
      bankName,
      accountNumber,
      accountType: accountType || "CHEQUE",
      branchCode: branchCode || null,
    },
    update: {
      bankName,
      accountNumber,
      accountType: accountType || "CHEQUE",
      branchCode: branchCode || null,
    },
  });

  return NextResponse.json({ ok: true });
}
