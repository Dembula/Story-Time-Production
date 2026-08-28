"use client";

import { Suspense, type ReactNode } from "react";
import { ProjectWorkspaceShell } from "./project-workspace-shell";

type ShellProps = {
  project: {
    id: string;
    title: string;
    isOriginal?: boolean;
    adminNote?: string | null;
  };
  switchableProjects: { id: string; title: string }[];
  children: ReactNode;
};

export function ProjectWorkspaceShellSuspense(props: ShellProps) {
  return (
    <Suspense
      fallback={
        <div className="creator-pipeline-shell creator-pipeline-shell--tool min-h-[calc(100vh-120px)]">
          <div className="creator-workspace-rail h-11 animate-pulse bg-white/[0.04]" />
          <div className="creator-pipeline-shell-tool-body h-40 animate-pulse bg-white/[0.03]" />
        </div>
      }
    >
      <ProjectWorkspaceShell {...props} />
    </Suspense>
  );
}
