"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import {
  ProjectContextBar,
} from "@/components/creator/project-context-bar";
import { resolveStandaloneFromProjectPath } from "@/lib/project-tools";
import { setActiveProjectId, sortProjectsWithActiveFirst } from "@/lib/active-project";
import { useActiveProjectId } from "@/hooks/use-active-project";

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
  const activeProjectId = useActiveProjectId();
  const currentProjectPrefix = `/creator/projects/${project.id}`;

  // Visiting a project workspace makes it the platform default selection.
  useEffect(() => {
    setActiveProjectId(project.id);
  }, [project.id]);

  const orderedProjects = useMemo(
    () => sortProjectsWithActiveFirst(switchableProjects, activeProjectId ?? project.id),
    [switchableProjects, activeProjectId, project.id],
  );

  const handleSwitchProject = (nextProjectId: string) => {
    setActiveProjectId(nextProjectId);
    const nextProjectPrefix = `/creator/projects/${nextProjectId}`;
    const nextPath = pathname.startsWith(currentProjectPrefix)
      ? pathname.replace(currentProjectPrefix, nextProjectPrefix)
      : `${nextProjectPrefix}/overview`;
    const qs = searchParams.toString();
    router.push(qs ? `${nextPath}?${qs}` : nextPath);
  };

  const handleClearProject = () => {
    setActiveProjectId(null);
    router.push(resolveStandaloneFromProjectPath(pathname));
  };

  return (
    <div
      className={`min-h-[calc(100vh-120px)] space-y-4 adaptive-content-density ${deviceClass === "tv" ? "adaptive-tv-surface" : ""}`}
    >
      <ProjectContextBar
        projectId={project.id}
        switchableProjects={orderedProjects}
        isOriginal={project.isOriginal}
        adminNote={project.adminNote}
        onSwitchProject={handleSwitchProject}
        onClearProject={handleClearProject}
      />

      <div className={`storytime-section ${deviceClass === "mobile" ? "p-4" : "p-5 md:p-6"}`}>{children}</div>
    </div>
  );
}
