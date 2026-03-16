"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FootageIngestionTool } from "@/components/project-tools/post/PostProductionTools";
import { Skeleton } from "@/components/ui/skeleton";

function PostFootageIngestionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });
  const projects = (data?.projects ?? []) as { id: string; title: string }[];

  const handleProjectChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete("projectId");
    else params.set("projectId", value);
    const qs = params.toString();
    router.push(qs ? `?${qs}` : ".");
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Footage Ingestion</h1>
          <p className="mt-1 text-sm text-slate-400">Add footage assets (URLs). Associate with scene when available.</p>
        </div>
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Link project (optional)</span>
          {isLoading ? (
            <Skeleton className="h-9 w-56 bg-slate-800/60" />
          ) : (
            <select
              value={projectId ?? ""}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-56 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
            >
              <option value="">No project selected</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          )}
        </div>
      </header>
      <FootageIngestionTool projectId={projectId} />
    </div>
  );
}

export default function PostFootageIngestionPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <PostFootageIngestionContent />
    </Suspense>
  );
}

