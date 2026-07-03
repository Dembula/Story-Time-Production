"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IdeaDevelopmentTool } from "@/components/project-tools/pre/IdeaDevelopmentTool";
import { Skeleton } from "@/components/ui/skeleton";
import { setActiveProjectId, sortProjectsWithActiveFirst } from "@/lib/active-project";
import { useActiveProjectId, useDefaultCreatorProjectId } from "@/hooks/use-active-project";

function ProjectsPreIdeaDevelopmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") ?? "";
  const activeProjectId = useActiveProjectId();

  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });

  const projectsRaw = (data?.projects ?? []) as {
    id: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
  }[];
  const projects = sortProjectsWithActiveFirst(projectsRaw, activeProjectId);
  const defaultProjectId = useDefaultCreatorProjectId(projectsRaw);
  const projectId = projectIdFromUrl || defaultProjectId || "";

  useEffect(() => {
    if (isLoading) return;
    if (projectIdFromUrl) {
      setActiveProjectId(projectIdFromUrl);
      return;
    }
    if (!defaultProjectId) return;
    setActiveProjectId(defaultProjectId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("projectId", defaultProjectId);
    router.replace(`?${params.toString()}`);
  }, [isLoading, projectIdFromUrl, defaultProjectId, router, searchParams]);

  const handleProjectChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      setActiveProjectId(null);
      params.delete("projectId");
    } else {
      setActiveProjectId(value);
      params.set("projectId", value);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "/creator/projects/pre-production/idea-development");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Linked project
          </span>
          {isLoading ? (
            <Skeleton className="h-9 w-56 bg-slate-800/60" />
          ) : (
            <select
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-56 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
            >
              <option value="">No project selected</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <IdeaDevelopmentTool projectId={projectId || undefined} />
    </div>
  );
}

export default function ProjectsPreIdeaDevelopmentPage() {
  return (
    <Suspense fallback={<div className="space-y-4 p-4 text-slate-400">Loading…</div>}>
      <ProjectsPreIdeaDevelopmentContent />
    </Suspense>
  );
}
