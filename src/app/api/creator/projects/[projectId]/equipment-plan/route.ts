import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const items = await prisma.equipmentPlanItem.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      equipmentListing: { select: { id: true, companyName: true, category: true } },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        department?: string | null;
        category: string;
        description?: string | null;
        quantity?: number;
        notes?: string | null;
        equipmentListingId?: string | null;
      }
    | null;

  if (!body?.category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const item = await prisma.equipmentPlanItem.create({
    data: {
      projectId,
      department: body.department ?? null,
      category: body.category,
      description: body.description ?? null,
      quantity: body.quantity ?? 1,
      notes: body.notes ?? null,
      equipmentListingId: body.equipmentListingId ?? null,
    },
    include: {
      equipmentListing: { select: { id: true, companyName: true, category: true } },
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        department?: string | null;
        category?: string;
        description?: string | null;
        quantity?: number;
        notes?: string | null;
        equipmentListingId?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.equipmentPlanItem.findFirst({
    where: { id: body.id, projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const item = await prisma.equipmentPlanItem.update({
    where: { id: body.id },
    data: {
      ...(body.department !== undefined ? { department: body.department } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.equipmentListingId !== undefined
        ? { equipmentListingId: body.equipmentListingId }
        : {}),
    },
    include: {
      equipmentListing: { select: { id: true, companyName: true, category: true } },
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.equipmentPlanItem.findFirst({
    where: { id, projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.equipmentPlanItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
