import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [agencies, inquiryCount, agencyCount, pendingInquiries, auditionCount] = await Promise.all([
    prisma.castingAgency.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { talent: true, inquiries: true, castingInvitations: true, auditionSubmissions: true } },
        inquiries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.castingInquiry.count(),
    prisma.castingAgency.count(),
    prisma.castingInquiry.count({ where: { status: "PENDING" } }),
    prisma.auditionPost.count(),
  ]);

  const totalTalent = agencies.reduce((acc, a) => acc + a._count.talent, 0);

  return NextResponse.json({
    agencies: agencies.map((a) => ({
      id: a.id,
      agencyName: a.agencyName,
      tagline: a.tagline,
      description: a.description,
      city: a.city,
      country: a.country,
      user: a.user,
      _count: {
        talent: a._count.talent,
        inquiries: a._count.inquiries,
        invitations: a._count.castingInvitations,
        auditionSubmissions: a._count.auditionSubmissions,
      },
      lastActivityAt: a.inquiries[0]?.createdAt?.toISOString() || a.updatedAt.toISOString(),
    })),
    agencyCount,
    totalTalent,
    inquiryCount,
    pendingInquiries,
    auditionCount,
  });
}
