import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const budget = await prisma.projectBudget.findUnique({
    where: { projectId: params.projectId },
    include: { lines: true },
  });
  return NextResponse.json({ budget });
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        template: "SHORT_FILM" | "INDIE_FILM" | "FEATURE_FILM" | "TV_EPISODE";
      }
    | null;

  if (!body?.template) {
    return NextResponse.json({ error: "Missing template" }, { status: 400 });
  }

  const existing = await prisma.projectBudget.findUnique({
    where: { projectId: params.projectId },
  });
  if (existing) {
    return NextResponse.json({ budget: existing }, { status: 200 });
  }

  const budget = await prisma.projectBudget.create({
    data: {
      projectId: params.projectId,
      template: body.template,
      currency: "ZAR",
      totalPlanned: 0,
    },
  });
  return NextResponse.json({ budget }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        lines: {
          id?: string;
          department?: string;
          name?: string;
          quantity?: number;
          unitCost?: number;
          total?: number;
          notes?: string | null;
        }[];
      }
    | null;

  if (!body?.lines) {
    return NextResponse.json({ error: "Missing lines" }, { status: 400 });
  }

  const projectId = params.projectId;

  const budget = await prisma.projectBudget.upsert({
    where: { projectId },
    create: {
      projectId,
      template: "SHORT_FILM",
      currency: "ZAR",
      totalPlanned: 0,
    },
    update: {},
  });

  await prisma.$transaction(async (tx) => {
    for (const line of body.lines) {
      const data: {
        department?: string;
        name?: string;
        quantity?: number | null;
        unitCost?: number | null;
        total?: number;
        notes?: string | null;
      } = {};

      if (line.department !== undefined) data.department = line.department ?? "";
      if (line.name !== undefined) data.name = line.name ?? "";
      if (line.quantity !== undefined) data.quantity = line.quantity ?? 1;
      if (line.unitCost !== undefined) data.unitCost = line.unitCost ?? 0;
      if (line.total !== undefined) data.total = line.total ?? 0;
      if (line.notes !== undefined) data.notes = line.notes ?? null;

      if (line.id) {
        await tx.projectBudgetLine.updateMany({
          where: { id: line.id, budgetId: budget.id },
          data,
        });
      } else {
        await tx.projectBudgetLine.create({
          data: {
            budgetId: budget.id,
            department: line.department ?? "",
            name: line.name ?? "",
            quantity: line.quantity ?? 1,
            unitCost: line.unitCost ?? 0,
            total: line.total ?? 0,
            notes: line.notes ?? null,
          },
        });
      }
    }
  });

  const updatedBudget = await prisma.projectBudget.findUnique({
    where: { id: budget.id },
    include: { lines: true },
  });

  return NextResponse.json({ budget: updatedBudget });
}
