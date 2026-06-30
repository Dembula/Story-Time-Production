import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listInventoryForCompany,
  registerInventoryTag,
  scanInventoryTag,
} from "@/lib/stakeholder-ecosystem/equipment-inventory-service";

async function requireEquipmentCompany() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || role !== "EQUIPMENT_COMPANY") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { userId };
}

export async function GET() {
  const access = await requireEquipmentCompany();
  if (access.error) return access.error;
  const data = await listInventoryForCompany(access.userId!);
  const listings = await prisma.equipmentListing.findMany({
    where: { companyId: access.userId },
    select: { id: true, companyName: true, category: true },
  });
  return NextResponse.json({ ...data, listings });
}

export async function POST(req: NextRequest) {
  const access = await requireEquipmentCompany();
  if (access.error) return access.error;
  const body = await req.json().catch(() => ({}));

  if (body.action === "scan" && body.rfidTag) {
    const result = await scanInventoryTag(access.userId!, body.rfidTag, body.location);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ tag: result.tag });
  }

  if (!body.equipmentId || !body.rfidTag) {
    return NextResponse.json({ error: "equipmentId and rfidTag required" }, { status: 400 });
  }

  const listing = await prisma.equipmentListing.findFirst({
    where: { id: body.equipmentId, companyId: access.userId },
  });
  if (!listing) return NextResponse.json({ error: "Equipment not found" }, { status: 404 });

  const tag = await registerInventoryTag({
    companyId: access.userId!,
    equipmentId: body.equipmentId,
    rfidTag: body.rfidTag,
    serialNumber: body.serialNumber,
  });
  return NextResponse.json({ tag }, { status: 201 });
}
