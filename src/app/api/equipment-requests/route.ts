import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  notifyEquipmentRequestCreated,
  notifyEquipmentRequestStatus,
} from "@/lib/marketplace-notifications";
import { buildMarketplaceBookingNote } from "@/lib/marketplace-booking-context";

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
    select: { companyId: true, companyName: true },
  });

  if (!equipment?.companyId) {
    return NextResponse.json({ error: "Equipment company not found" }, { status: 400 });
  }

  const note = buildMarketplaceBookingNote(body.note || null, {
    projectId: body.projectId ?? null,
    projectTitle: body.projectTitle ?? null,
  });

  const request = await prisma.equipmentRequest.create({
    data: {
      equipmentId: body.equipmentId,
      requesterId: userId,
      companyId: equipment.companyId,
      note,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
    },
    include: {
      equipment: { select: { companyName: true, category: true } },
      requester: { select: { name: true } },
    },
  });

  try {
    const requesterName = request.requester?.name;
    await notifyEquipmentRequestCreated({
      companyUserId: equipment.companyId,
      requesterName,
      equipmentName: equipment.companyName,
      requestId: request.id,
    });
  } catch {
    /* notification failure must not block booking */
  }

  return NextResponse.json(request);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  const role = (session.user as { role?: string })?.role;
  const body = await req.json();

  const existing = await prisma.equipmentRequest.findUnique({
    where: { id: body.id },
    include: { equipment: { select: { companyName: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (existing.companyId !== userId && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.equipmentRequest.update({
    where: { id: body.id },
    data: { status: body.status },
  });

  if (body.status && body.status !== existing.status) {
    try {
      await notifyEquipmentRequestStatus({
        creatorUserId: existing.requesterId,
        equipmentName: existing.equipment.companyName,
        status: body.status,
        requestId: existing.id,
      });
    } catch {
      /* non-blocking */
    }
  }

  return NextResponse.json(updated);
}
