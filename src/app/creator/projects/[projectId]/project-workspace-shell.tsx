"use client";

import { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import {
  ProjectContextBar,
} from "@/components/creator/project-context-bar";
import { resolveStandaloneFromProjectPath } from "@/lib/project-tools";

type OriginalProject = {
  id: string;
  title: string;
  isOriginal?: boolean;
  adminNote?: string | null;
};

interface ProjectWorkspaceShellProps {
  project: OriginalProject;
  switchableProjects: { id: string; title: string }[];
  children: ReactNode;
}

export function ProjectWorkspaceShell({
  project,
  switchableProjects,
  children,
}: ProjectWorkspaceShellProps) {
  const { deviceClass } = useAdaptiveUi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentProjectPrefix = `/creator/projects/${project.id}`;

  const handleSwitchProject = (nextProjectId: string) => {
    const nextProjectPrefix = `/creator/projects/${nextProjectId}`;
    const nextPath = pathname.startsWith(currentProjectPrefix)
      ? pathname.replace(currentProjectPrefix, nextProjectPrefix)
      : `${nextProjectPrefix}/overview`;
    const qs = searchParams.toString();
    router.push(qs ? `${nextPath}?${qs}` : nextPath);
  };

  const handleClearProject = () => {
    router.push(resolveStandaloneFromProjectPath(pathname));
  };

  return (
    <div
      className={`min-h-[calc(100vh-120px)] space-y-4 adaptive-content-density ${deviceClass === "tv" ? "adaptive-tv-surface" : ""}`}
    >
      <ProjectContextBar
        projectId={project.id}
        switchableProjects={switchableProjects}
        isOriginal={project.isOriginal}
        adminNote={project.adminNote}
        onSwitchProject={handleSwitchProject}
        onClearProject={handleClearProject}
      />

      <div className={`storytime-section ${deviceClass === "mobile" ? "p-4" : "p-5 md:p-6"}`}>{children}</div>
    </div>
  );
}
