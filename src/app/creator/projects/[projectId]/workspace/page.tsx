import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectWorkspaceShell } from "../project-workspace-shell";

interface PageProps {
  params: { projectId: string };
}

export default async function ProjectWorkspacePage({ params }: PageProps) {
  const project = await prisma.originalProject.findUnique({
    where: { id: params.projectId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
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
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Use the sidebar to jump into any Pre-Production, Production, or
          Post-Production tool for this project. Your work in each tool is
          saved against the same project.
        </p>
      </div>
    </ProjectWorkspaceShell>
  );
}

