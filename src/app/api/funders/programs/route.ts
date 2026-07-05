import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/funders";
import { shapeFundingProgramForMarketplace } from "@/lib/funding-programs";

export async function GET() {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (access.role !== "FUNDER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await prisma.funderProfile.findUnique({ where: { userId: access.userId! } });
  if (!profile) return NextResponse.json({ programs: [] });

  const programs = await prisma.fundingProgram.findMany({
    where: { funderProfileId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return NextResponse.json({
    programs: programs.map((p) => ({
      ...shapeFundingProgramForMarketplace(p),
      id: p.id,
      status: p.status,
      visible: p.visible,
      applicationCount: p._count.applications,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (access.role !== "FUNDER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await prisma.funderProfile.findUnique({ where: { userId: access.userId! } });
  if (!profile) return NextResponse.json({ error: "Complete funder profile first" }, { status: 400 });

  const body = await req.json();
  if (!body?.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const program = await prisma.fundingProgram.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      programType: body.programType ?? "GRANT",
      funderType: body.funderType ?? "PRIVATE",
      managedBy: "FUNDER",
      createdByUserId: access.userId!,
      funderProfileId: profile.id,
      minAmount: body.minAmount != null ? Number(body.minAmount) : null,
      maxAmount: body.maxAmount != null ? Number(body.maxAmount) : null,
      categories: body.categories ? JSON.stringify(body.categories) : null,
      requirements: body.requirements ? JSON.stringify(body.requirements) : null,
      applicationDeadline: body.applicationDeadline ? new Date(body.applicationDeadline) : null,
      contactEmail: body.contactEmail?.trim() || null,
      region: body.region?.trim() || null,
      status: body.status ?? "ACTIVE",
      visible: body.visible !== false,
    },
  });

  return NextResponse.json({ program }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (access.role !== "FUNDER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await prisma.funderProfile.findUnique({ where: { userId: access.userId! } });
  if (!profile) return NextResponse.json({ error: "Funder profile not found" }, { status: 404 });

  const body = await req.json();
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.fundingProgram.findFirst({
    where: { id: body.id, funderProfileId: profile.id },
  });
  if (!existing) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const program = await prisma.fundingProgram.update({
    where: { id: body.id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.visible !== undefined ? { visible: !!body.visible } : {}),
    },
  });

  return NextResponse.json({ program });
}
