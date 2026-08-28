"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isCreatorPipelineToolPath } from "@/lib/project-tools";
import { ProjectContextBar, type ProjectSwitcherOption } from "@/components/creator/project-context-bar";

type PipelineWorkspaceShellProps = {
  projectId: string;
  switchableProjects: ProjectSwitcherOption[];
  isOriginal?: boolean;
  adminNote?: string | null;
  onSwitchProject: (nextProjectId: string) => void;
  onClearProject: () => void;
  children: ReactNode;
};

export function PipelineWorkspaceShell({
  projectId,
  switchableProjects,
  isOriginal,
  adminNote,
  onSwitchProject,
  onClearProject,
  children,
}: PipelineWorkspaceShellProps) {
  const pathname = usePathname();
  const pipelineTool = isCreatorPipelineToolPath(pathname);

  return (
    <div className={pipelineTool ? "creator-pipeline-shell creator-pipeline-shell--tool" : "creator-pipeline-shell"}>
      <ProjectContextBar
        projectId={projectId}
        switchableProjects={switchableProjects}
        isOriginal={isOriginal}
        adminNote={adminNote}
        onSwitchProject={onSwitchProject}
        onClearProject={onClearProject}
        embedded={pipelineTool}
      />
      {pipelineTool ? (
        <div className="creator-pipeline-shell-tool-body">{children}</div>
      ) : (
        <div className="storytime-section p-5 md:p-6">{children}</div>
      )}
    </div>
  );
}
