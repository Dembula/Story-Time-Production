import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const NEED_LINK_MARKER_PREFIX = "crewNeedId:";

function needMarker(needId: string) {
  return `${NEED_LINK_MARKER_PREFIX}${needId}`;
}

async function ensureCrewAccess(projectId: string) {
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

  return { error: null as NextResponse | null, userId, project };
}

// List crew needs for the project with basic invitation counts
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCrewAccess(projectId);
  if (access.error) return access.error;

  const needs = await prisma.crewRoleNeed.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      invitations: true,
    },
  });
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { lines: true },
  });
  const roster = await prisma.creatorCrewRoster.findMany({
    where: { creatorId: access.userId! },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    needs: needs.map((n) => ({
      id: n.id,
      department: n.department,
      role: n.role,
      seniority: n.seniority,
      notes: n.notes,
      invitationsCount: n.invitations.length,
      linkedRate:
        budget?.lines.find((line) => (line.notes ?? "").includes(needMarker(n.id)))?.unitCost ?? null,
      assignedCrew:
        roster.find((entry) => (entry.notes ?? "").includes(needMarker(n.id)))?.name ?? null,
    })),
  });
}

// Create a new crew role need
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCrewAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        department?: string | null;
        role: string;
        seniority?: string | null;
        notes?: string | null;
        hireName?: string | null;
        hireEmail?: string | null;
        hirePhone?: string | null;
        dailyRate?: number | null;
      }
    | null;

  if (!body?.role) {
    return NextResponse.json({ error: "Missing role" }, { status: 400 });
  }

  const need = await prisma.crewRoleNeed.create({
    data: {
      projectId,
      department: body.department ?? null,
      role: body.role,
      seniority: body.seniority ?? null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ need }, { status: 201 });
}

// Update an existing crew role need
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCrewAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        department?: string | null;
        role?: string;
        seniority?: string | null;
        notes?: string | null;
        hireName?: string | null;
        hireEmail?: string | null;
        hirePhone?: string | null;
        dailyRate?: number | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const marker = needMarker(body.id);
  const need = await prisma.$transaction(async (tx) => {
    const nextNeed = await tx.crewRoleNeed.update({
      where: { id: body.id },
      data: {
        ...(body.department !== undefined ? { department: body.department } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.seniority !== undefined ? { seniority: body.seniority } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    if (body.dailyRate !== undefined && body.dailyRate !== null) {
      const budget = await tx.projectBudget.upsert({
        where: { projectId },
        create: {
          projectId,
          template: "SHORT_FILM",
          currency: "ZAR",
          totalPlanned: 0,
        },
        update: {},
      });
      const existingLine = await tx.projectBudgetLine.findFirst({
        where: { budgetId: budget.id, notes: { contains: marker } },
      });
      const amount = Math.max(0, Number(body.dailyRate) || 0);
      const lineNotes = `${body.notes ?? ""}\n[${marker}]`.trim();
      if (existingLine) {
        await tx.projectBudgetLine.update({
          where: { id: existingLine.id },
          data: {
            department: "CREW",
            name: `Crew · ${nextNeed.role}`,
            quantity: 1,
            unitCost: amount,
            total: amount,
            notes: lineNotes,
          },
        });
      } else {
        await tx.projectBudgetLine.create({
          data: {
            budgetId: budget.id,
            department: "CREW",
            name: `Crew · ${nextNeed.role}`,
            quantity: 1,
            unitCost: amount,
            total: amount,
            notes: lineNotes,
          },
        });
      }
    }

    if (body.hireName !== undefined) {
      const existingCrew = await tx.creatorCrewRoster.findFirst({
        where: { creatorId: access.userId!, notes: { contains: marker } },
      });
      const cleanName = body.hireName?.trim() ?? "";
      if (!cleanName) {
        if (existingCrew) await tx.creatorCrewRoster.delete({ where: { id: existingCrew.id } });
      } else if (existingCrew) {
        await tx.creatorCrewRoster.update({
          where: { id: existingCrew.id },
          data: {
            name: cleanName,
            role: nextNeed.role,
            department: nextNeed.department,
            contactEmail: body.hireEmail ?? existingCrew.contactEmail,
            phone: body.hirePhone ?? existingCrew.phone,
            notes: `${body.notes ?? ""}\n[${marker}]`.trim(),
          },
        });
      } else {
        await tx.creatorCrewRoster.create({
          data: {
            creatorId: access.userId!,
            name: cleanName,
            role: nextNeed.role,
            department: nextNeed.department,
            contactEmail: body.hireEmail ?? null,
            phone: body.hirePhone ?? null,
            notes: `${body.notes ?? ""}\n[${marker}]`.trim(),
          },
        });
      }
    }

    return nextNeed;
  });

  return NextResponse.json({ need });
}

