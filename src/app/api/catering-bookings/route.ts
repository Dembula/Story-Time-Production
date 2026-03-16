import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const role = (session.user as { role?: string }).role;
  if (role === "CONTENT_CREATOR") {
    const bookings = await prisma.cateringBooking.findMany({
      where: { creatorId: user.id },
      include: { cateringCompany: { select: { companyName: true, tagline: true, userId: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(bookings);
  }
  if (role === "CATERING_COMPANY") {
    const company = await prisma.cateringCompany.findUnique({ where: { userId: user.id } });
    if (!company) return NextResponse.json([]);
    const bookings = await prisma.cateringBooking.findMany({
      where: { cateringCompanyId: company.id },
      include: { creator: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(bookings);
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { cateringCompanyId, eventDate, headCount, note } = body as { cateringCompanyId?: string; eventDate?: string; headCount?: number; note?: string };
  if (!cateringCompanyId) return NextResponse.json({ error: "cateringCompanyId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: session?.user?.email ?? undefined } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.cateringCompany.findUnique({ where: { id: cateringCompanyId } });
  if (!company) return NextResponse.json({ error: "Catering company not found" }, { status: 404 });

  const booking = await prisma.cateringBooking.create({
    data: {
      cateringCompanyId,
      creatorId: user.id,
      eventDate: eventDate || null,
      headCount: headCount ?? null,
      note: note || null,
      status: "PENDING",
    },
    include: { cateringCompany: { select: { companyName: true, userId: true } } },
  });

  return NextResponse.json(booking);
}
