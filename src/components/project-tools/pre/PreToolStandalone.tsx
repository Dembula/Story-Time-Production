"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PreProductionToolPageImpl from "@/app/creator/projects/[projectId]/pre-production/[tool]/page";
import { ProjectContextBarStandalone } from "@/components/creator/project-context-bar";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import { setActiveProjectId, sortProjectsWithActiveFirst } from "@/lib/active-project";
import { useActiveProjectId, useDefaultCreatorProjectId } from "@/hooks/use-active-project";

interface PreToolStandaloneProps {
  toolSlug: string;
  title: string;
  description: string;
}

function PreToolStandaloneContent({ toolSlug }: PreToolStandaloneProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const projectIdFromUrl = searchParams.get("projectId") ?? "";
  const activeProjectId = useActiveProjectId();
  const skipAutoLinkRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: projectToolQueryFn("/api/creator/projects"),
  });

  const projects = useMemo(
    () =>
      ((data?.projects ?? []) as {
        id: string;
        title: string;
        createdAt?: string;
        updatedAt?: string;
        canUseTools?: boolean;
      }[]).filter((p) => p.canUseTools !== false),
    [data?.projects],
  );
  const orderedProjects = sortProjectsWithActiveFirst(projects, activeProjectId);
  const defaultProjectId = useDefaultCreatorProjectId(projects);

  // Auto-link standalone tools to the active/newest project the user can actually use.
  useEffect(() => {
    if (isLoading) return;
    if (projectIdFromUrl && projects.some((p) => p.id === projectIdFromUrl)) return;
    if (!defaultProjectId) return;
    if (skipAutoLinkRef.current && !activeProjectId) return;
    skipAutoLinkRef.current = false;
    setActiveProjectId(defaultProjectId);
    router.replace(`/creator/projects/${defaultProjectId}/pre-production/${toolSlug}`);
  }, [
    isLoading,
    projectIdFromUrl,
    defaultProjectId,
    activeProjectId,
    router,
    toolSlug,
    projects,
  ]);

  useEffect(() => {
    if (projectIdFromUrl && projects.some((p) => p.id === projectIdFromUrl)) {
      skipAutoLinkRef.current = false;
      setActiveProjectId(projectIdFromUrl);
    }
  }, [projectIdFromUrl, projects]);

  const handleProjectChange = (value: string) => {
    if (value) {
      skipAutoLinkRef.current = false;
      setActiveProjectId(value);
      router.push(`/creator/projects/${value}/pre-production/${toolSlug}`);
      return;
    }
    skipAutoLinkRef.current = true;
    setActiveProjectId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("projectId");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const selectedProjectId =
    (projectIdFromUrl && projects.some((p) => p.id === projectIdFromUrl)
      ? projectIdFromUrl
      : null) ||
    defaultProjectId ||
    "";

  return (
    <div className="creator-pipeline-shell creator-pipeline-shell--tool">
      <ProjectContextBarStandalone
        projectId={selectedProjectId}
        projects={orderedProjects}
        isLoading={isLoading}
        onChange={handleProjectChange}
      />
      <div className="creator-pipeline-shell-tool-body">
        <PreProductionToolPageImpl
          params={Promise.resolve({
            projectId: selectedProjectId || undefined,
            tool: toolSlug,
          })}
        />
      </div>
    </div>
  );
}

export function PreToolStandalone(props: PreToolStandaloneProps) {
  return (
    <Suspense fallback={<div className="space-y-4 p-4 text-slate-400">Loading…</div>}>
      <PreToolStandaloneContent {...props} />
    </Suspense>
  );
}
