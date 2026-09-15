import Link from "next/link";
import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStoryTimeOriginalGreenlit } from "@/lib/storytime-original";
import { ProjectWorkspaceShellSuspense } from "./project-workspace-shell-suspense";

const TOOL_MEMBER_STATUSES = new Set(["ACTIVE", "ACCEPTED"]);

interface ProjectLayoutProps {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    notFound();
  }

  const project = await prisma.originalProject.findFirst({
    where: {
      id: projectId,
      ...(role === "ADMIN"
        ? {}
        : {
            OR: [{ pitches: { some: { creatorId: userId } } }, { members: { some: { userId } } }],
          }),
    },
    include: {
      pitches: {
        select: { id: true, status: true, creatorId: true },
        orderBy: { createdAt: "desc" },
      },
      members: {
        where: { userId },
        select: { status: true },
        take: 1,
      },
    },
  });

  if (!project) {
    notFound();
  }

  const latestPitch = project.pitches[0];
  const isOriginal = isStoryTimeOriginalGreenlit(latestPitch);
  const isPitchOwner = project.pitches.some((p) => p.creatorId === userId);
  const myStatus = project.members[0]?.status ?? null;
  const canUseTools =
    role === "ADMIN" ||
    isPitchOwner ||
    Boolean(myStatus && TOOL_MEMBER_STATUSES.has(myStatus));

  if (!canUseTools) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300/80">
          Pending invite
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-white">{project.title}</h1>
        <p className="mt-3 text-sm text-slate-400">
          {myStatus === "INVITED"
            ? "Accept this collaboration invite in My Projects before using Treatment Creator and other tools. Open invites never block the project owner."
            : "You don’t have access to this project’s tools yet."}
        </p>
        <Link
          href="/creator/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-orange-500 px-4 text-sm font-medium text-white hover:bg-orange-600"
        >
          Open My Projects
        </Link>
      </div>
    );
  }

  const switchableProjects = await prisma.originalProject.findMany({
    where:
      role === "ADMIN"
        ? {}
        : {
            OR: [
              { pitches: { some: { creatorId: userId } } },
              { members: { some: { userId, status: { in: ["ACTIVE", "ACCEPTED"] } } } },
            ],
          },
    select: {
      id: true,
      title: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <ProjectWorkspaceShellSuspense
      project={{
        id: project.id,
        title: project.title,
        isOriginal,
        adminNote: project.adminNote ?? null,
      }}
      switchableProjects={switchableProjects.map((p) => ({ id: p.id, title: p.title }))}
    >
      {children}
    </ProjectWorkspaceShellSuspense>
  );
}

