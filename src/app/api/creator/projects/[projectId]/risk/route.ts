import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

async function ensureRiskAccess(projectId: string) {
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
  const access = await ensureRiskAccess(params.projectId);
  if (access.error) return access.error;

  let plan = await prisma.riskPlan.findUnique({
    where: { projectId: params.projectId },
    include: { items: true },
  });

  if (!plan) {
    plan = await prisma.riskPlan.create({
      data: {
        projectId: params.projectId,
        summary: null,
      },
      include: { items: true },
    });
  }

  return NextResponse.json({ plan });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await ensureRiskAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        summary?: string | null;
        items?: {
          id?: string;
          category: string;
          description: string;
          ownerId?: string | null;
          status?: string;
        }[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let plan = await prisma.riskPlan.findUnique({
    where: { projectId: params.projectId },
  });

  if (!plan) {
    plan = await prisma.riskPlan.create({
      data: { projectId: params.projectId, summary: body.summary ?? null },
    });
  } else if (body.summary !== undefined) {
    plan = await prisma.riskPlan.update({
      where: { id: plan.id },
      data: { summary: body.summary },
    });
  }

  const tx: Promise<unknown>[] = [];

  if (body.items) {
    for (const item of body.items) {
      if (item.id) {
        tx.push(
          prisma.riskChecklistItem.update({
            where: { id: item.id },
            data: {
              category: item.category,
              description: item.description,
              ownerId: item.ownerId ?? null,
              ...(item.status ? { status: item.status } : {}),
            },
          })
        );
      } else {
        tx.push(
          prisma.riskChecklistItem.create({
            data: {
              planId: plan.id,
              category: item.category,
              description: item.description,
              ownerId: item.ownerId ?? null,
              status: item.status ?? "OPEN",
            },
          })
        );
      }
    }
  }

  if (tx.length > 0) {
    await prisma.$transaction(tx);
  }

  const updated = await prisma.riskPlan.findUnique({
    where: { id: plan.id },
    include: { items: true },
  });

  return NextResponse.json({ plan: updated });
}

