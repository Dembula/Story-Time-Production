import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectWorkspaceShell } from "./project-workspace-shell";

interface ProjectLayoutProps {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { projectId } = await params;
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
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

  return (
    <ProjectWorkspaceShell
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
    >
      {children}
    </ProjectWorkspaceShell>
  );
}

