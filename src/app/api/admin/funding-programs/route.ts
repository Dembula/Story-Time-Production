import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shapeFundingProgramForMarketplace } from "@/lib/funding-programs";

function requireAdmin(session: { user?: { role?: string; id?: string } } | null) {
  const role = session?.user?.role;
  if (role !== "ADMIN") return null;
  return session?.user?.id ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const adminId = requireAdmin(session);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const programs = await prisma.fundingProgram.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      funderProfile: { select: { legalName: true, user: { select: { name: true, professionalName: true } } } },
      _count: { select: { applications: true } },
    },
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
  const session = await getServerSession(authOptions);
  const adminId = requireAdmin(session);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body?.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const program = await prisma.fundingProgram.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      programType: body.programType ?? "GRANT",
      funderType: body.funderType ?? "INSTITUTIONAL",
      managedBy: "ADMIN",
      createdByUserId: adminId,
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
  const session = await getServerSession(authOptions);
  const adminId = requireAdmin(session);
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const program = await prisma.fundingProgram.update({
    where: { id: body.id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.visible !== undefined ? { visible: !!body.visible } : {}),
      ...(body.minAmount !== undefined ? { minAmount: body.minAmount != null ? Number(body.minAmount) : null } : {}),
      ...(body.maxAmount !== undefined ? { maxAmount: body.maxAmount != null ? Number(body.maxAmount) : null } : {}),
    },
  });

  return NextResponse.json({ program });
}
