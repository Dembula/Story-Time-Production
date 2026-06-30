import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const financeProjectInclude = { members: true, pitches: true } as const;

type FinanceProject = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.originalProject.findUnique<{ where: { id: string }; include: typeof financeProjectInclude }>
    >
  >
>;

type FinanceAccessFailure = {
  error: NextResponse;
  userId: null;
};

type FinanceAccessSuccess = {
  error: null;
  userId: string;
  project: FinanceProject;
};

export type FinanceAccessResult = FinanceAccessFailure | FinanceAccessSuccess;

export function financeAccessDenied(access: FinanceAccessResult): access is FinanceAccessFailure {
  return access.error !== null;
}

export async function ensureProjectFinanceAccess(projectId: string): Promise<FinanceAccessResult> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: financeProjectInclude,
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null };
  }

  return { error: null, userId, project };
}
