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
        <div className="min-h-[calc(100vh-120px)] space-y-4">
          <div className="storytime-plan-card h-11 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="storytime-section h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
        </div>
      }
    >
      <ProjectWorkspaceShell {...props} />
    </Suspense>
  );
}
