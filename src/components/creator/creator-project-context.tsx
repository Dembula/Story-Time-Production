"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { getProjectToolHref, type ProjectPhase } from "@/lib/project-tools";

export type CreatorProjectContextConfig = {
  phase: ProjectPhase;
  toolSlug: string;
  /** When embedded in a project workspace (no ?projectId= in URL). */
  projectIdOverride?: string;
  roleIdOverride?: string;
};

export function useCreatorProjectContext(config: CreatorProjectContextConfig) {
  const searchParams = useSearchParams();
  const projectId = config.projectIdOverride ?? (searchParams.get("projectId") || undefined);
  const roleId = config.roleIdOverride ?? (searchParams.get("roleId") || undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
    enabled: !!projectId,
  });

  const projects = (data?.projects ?? []) as { id: string; title: string }[];
  const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
  const projectTitle = project?.title ?? null;
  const workspaceHref = projectId
    ? getProjectToolHref(projectId, { phase: config.phase, toolSlug: config.toolSlug })
    : null;

  return {
    projectId,
    roleId,
    projectTitle,
    workspaceHref,
    projectLoading: !!projectId && isLoading,
    projectFound: !!project,
  };
}

/** Prefill a string field once when project title resolves (e.g. project name on requests). */
export function usePrefillProjectName(projectTitle: string | null, onPrefill: (title: string) => void) {
  const didPrefill = useRef(false);
  useEffect(() => {
    if (!projectTitle || didPrefill.current) return;
    didPrefill.current = true;
    onPrefill(projectTitle);
  }, [projectTitle, onPrefill]);
}

type BannerProps = CreatorProjectContextConfig & {
  accent?: "violet" | "emerald" | "orange" | "cyan" | "amber";
  roleHint?: string;
  projectIdOverride?: string;
  roleIdOverride?: string;
};

const accentBorder: Record<NonNullable<BannerProps["accent"]>, string> = {
  violet: "border-violet-500/30 bg-violet-500/10",
  emerald: "border-emerald-500/30 bg-emerald-500/10",
  orange: "border-orange-500/30 bg-orange-500/10",
  cyan: "border-cyan-500/30 bg-cyan-500/10",
  amber: "border-amber-500/30 bg-amber-500/10",
};

export function CreatorProjectContextBanner({
  phase,
  toolSlug,
  accent = "orange",
  roleHint,
  projectIdOverride,
  roleIdOverride,
}: BannerProps) {
  const { projectId, projectTitle, workspaceHref, projectLoading, roleId } = useCreatorProjectContext({
    phase,
    toolSlug,
    projectIdOverride,
    roleIdOverride,
  });

  if (!projectId) return null;

  return (
    <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${accentBorder[accent]}`}>
      <p className="font-medium text-white">
        Linked to project: {projectLoading ? "Loading…" : projectTitle || projectId}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Actions from this page are tied to your production workflow.
        {roleId && roleHint ? ` ${roleHint}` : null}
        {roleId && !roleHint ? " A specific role is selected from the casting portal." : null}
      </p>
      {workspaceHref && (
        <Link
          href={workspaceHref}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-orange-300 hover:text-orange-200"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Back to project tool workspace
        </Link>
      )}
    </div>
  );
}
