import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [agencies, inquiryCount, agencyCount] = await Promise.all([
    prisma.castingAgency.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { talent: true, inquiries: true } },
      },
    }),
    prisma.castingInquiry.count(),
    prisma.castingAgency.count(),
  ]);

  const totalTalent = agencies.reduce((acc, a) => acc + a._count.talent, 0);
  const pendingInquiries = await prisma.castingInquiry.count({ where: { status: "PENDING" } });

  const auditionCount = await prisma.auditionPost.count();

  return NextResponse.json({
    agencies,
    agencyCount,
    totalTalent,
    inquiryCount,
    pendingInquiries,
    auditionCount,
  });
}
