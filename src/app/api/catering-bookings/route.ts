import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  notifyCateringBookingCreated,
  notifyCateringBookingStatus,
} from "@/lib/marketplace-notifications";

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

  const company = await prisma.cateringCompany.findUnique({
    where: { id: cateringCompanyId },
    select: { id: true, companyName: true, userId: true },
  });
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

  try {
    await notifyCateringBookingCreated({
      companyUserId: company.userId,
      creatorName: user.name,
      companyName: company.companyName,
      bookingId: booking.id,
    });
  } catch {
    /* non-blocking */
  }

  return NextResponse.json(booking);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "CATERING_COMPANY" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const company = await prisma.cateringCompany.findUnique({ where: { userId: user.id } });
  if (!company) return NextResponse.json({ error: "Catering company not found" }, { status: 404 });

  const body = await req.json();
  const { id, status } = body as { id?: string; status?: string };
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const existing = await prisma.cateringBooking.findFirst({
    where: { id, cateringCompanyId: company.id },
    include: { cateringCompany: { select: { companyName: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const updated = await prisma.cateringBooking.update({
    where: { id },
    data: { status },
  });

  if (status !== existing.status) {
    try {
      await notifyCateringBookingStatus({
        creatorUserId: existing.creatorId,
        companyName: existing.cateringCompany.companyName,
        status,
        bookingId: id,
      });
    } catch {
      /* non-blocking */
    }
  }

  return NextResponse.json(updated);
}
