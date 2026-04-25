import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStudioPipelineContext } from "@/lib/creator-studio";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";
import { ProjectWorkspaceShell } from "./project-workspace-shell";

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
      members: { include: { user: true } },
      pitches: {
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const latestPitch = project.pitches[0];
  const isOriginal = !!latestPitch && latestPitch.status !== "DRAFT";
  const studioCtx = await loadStudioPipelineContext(userId);
  const pipelineAccess = Boolean(studioCtx?.pipelineAccess);
  const suiteAccess = studioCtx?.suiteAccess ?? defaultSuiteAccessOpen();

  const switchableProjects = await prisma.originalProject.findMany({
    where:
      role === "ADMIN"
        ? {}
        : {
            OR: [{ pitches: { some: { creatorId: userId } } }, { members: { some: { userId } } }],
          },
    select: {
      id: true,
      title: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <ProjectWorkspaceShell
      pipelineAccess={pipelineAccess}
      suiteAccess={suiteAccess}
      project={{
        id: project.id,
        title: project.title,
        status: project.status,
        phase: project.phase,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        members: project.members.map((m) => ({
          id: m.id,
          role: m.role,
          user: { id: m.user.id, name: m.user.name },
        })),
        isOriginal,
        adminNote: project.adminNote ?? null,
      }}
      switchableProjects={switchableProjects.map((p) => ({ id: p.id, title: p.title }))}
    >
      {children}
    </ProjectWorkspaceShell>
  );
}

