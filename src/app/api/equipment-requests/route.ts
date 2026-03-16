import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id!;

  if (role === "EQUIPMENT_COMPANY") {
    const requests = await prisma.equipmentRequest.findMany({
      where: { companyId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        equipment: { select: { companyName: true, category: true, description: true } },
        requester: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
    });
    return NextResponse.json(requests);
  }

  const requests = await prisma.equipmentRequest.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      equipment: { select: { companyName: true, category: true, description: true } },
      company: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  const body = await req.json();

  const equipment = await prisma.equipmentListing.findUnique({
    where: { id: body.equipmentId },
    select: { companyId: true },
  });

  if (!equipment?.companyId) {
    return NextResponse.json({ error: "Equipment company not found" }, { status: 400 });
  }

  const request = await prisma.equipmentRequest.create({
    data: {
      equipmentId: body.equipmentId,
      requesterId: userId,
      companyId: equipment.companyId,
      note: body.note || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
    },
    include: {
      equipment: { select: { companyName: true, category: true } },
    },
  });

  return NextResponse.json(request);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updated = await prisma.equipmentRequest.update({
    where: { id: body.id },
    data: { status: body.status },
  });
  return NextResponse.json(updated);
}
