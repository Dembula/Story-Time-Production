import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const projectInclude = { members: true, pitches: true } as const;

type ProjectRecord = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.originalProject.findUnique<{ where: { id: string }; include: typeof projectInclude }>
    >
  >
>;

type ProjectAccessFailure = {
  error: NextResponse;
  userId: null;
  project: null;
};

type ProjectAccessSuccess = {
  error: null;
  userId: string;
  project: ProjectRecord;
};

export type ProjectAccessResult = ProjectAccessFailure | ProjectAccessSuccess;

export function projectAccessDenied(access: ProjectAccessResult): access is ProjectAccessFailure {
  return access.error !== null;
}

const ACTIVE_MEMBER_STATUSES = new Set(["ACTIVE", "ACCEPTED"]);

export async function ensureProjectAccess(projectId: string): Promise<ProjectAccessResult> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      project: null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: projectInclude,
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null,
      project: null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.pitches.some((p) => p.creatorId === userId) ||
    project.members.some((m) => m.userId === userId && ACTIVE_MEMBER_STATUSES.has(m.status));

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      project: null,
    };
  }

  return { error: null, userId, project };
}
