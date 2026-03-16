import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBudget, initBudget, saveBudgetLines } from "@/lib/budgetStore";

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

  const budget = await getBudget(params.projectId);
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

  const budget = await initBudget(params.projectId, body.template);
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

  const budget = await saveBudgetLines(params.projectId, body.lines);
  return NextResponse.json({ budget });
}
