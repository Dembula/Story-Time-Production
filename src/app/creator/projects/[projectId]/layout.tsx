import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStoryTimeOriginalGreenlit } from "@/lib/storytime-original";
import { ProjectWorkspaceShellSuspense } from "./project-workspace-shell-suspense";

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
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const latestPitch = project.pitches[0];
  const isOriginal = isStoryTimeOriginalGreenlit(latestPitch);

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

