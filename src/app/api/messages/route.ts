import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  const requestId = req.nextUrl.searchParams.get("requestId");
  const locationBookingId = req.nextUrl.searchParams.get("locationBookingId");
  const crewTeamRequestId = req.nextUrl.searchParams.get("crewTeamRequestId");
  const castingInquiryId = req.nextUrl.searchParams.get("castingInquiryId");
  const cateringBookingId = req.nextUrl.searchParams.get("cateringBookingId");

  if (requestId) {
    const messages = await prisma.message.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(messages);
  }
  if (locationBookingId) {
    const messages = await prisma.message.findMany({
      where: { locationBookingId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(messages);
  }
  if (crewTeamRequestId) {
    const messages = await prisma.message.findMany({
      where: { crewTeamRequestId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(messages);
  }
  if (castingInquiryId) {
    const messages = await prisma.message.findMany({
      where: { castingInquiryId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(messages);
  }
  if (cateringBookingId) {
    const messages = await prisma.message.findMany({
      where: { cateringBookingId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(messages);
  }

  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receiver: { select: { id: true, name: true, role: true } },
      request: { select: { id: true, equipment: { select: { companyName: true, category: true } } } },
      locationBooking: { select: { id: true, location: { select: { name: true, type: true } } } },
      crewTeamRequest: { select: { id: true, crewTeam: { select: { companyName: true } } } },
      castingInquiry: { select: { id: true, agency: { select: { agencyName: true } } } },
      cateringBooking: { select: { id: true, cateringCompany: { select: { companyName: true } } } },
    },
  });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  const body = await req.json();

  const message = await prisma.message.create({
    data: {
      body: body.body,
      senderId: userId,
      receiverId: body.receiverId,
      requestId: body.requestId || null,
      locationBookingId: body.locationBookingId || null,
      crewTeamRequestId: body.crewTeamRequestId || null,
      castingInquiryId: body.castingInquiryId || null,
      cateringBookingId: body.cateringBookingId || null,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });
  return NextResponse.json(message);
}
