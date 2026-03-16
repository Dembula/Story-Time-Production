"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PreProductionToolPageImpl from "@/app/creator/projects/[projectId]/pre-production/[tool]/page";
import { Skeleton } from "@/components/ui/skeleton";

interface PreToolStandaloneProps {
  toolSlug: string;
  title: string;
  description: string;
}

export function PreToolStandalone({ toolSlug, title, description }: PreToolStandaloneProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const projectId = searchParams.get("projectId") ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });

  const projects = (data?.projects ?? []) as { id: string; title: string }[];

  const handleProjectChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("projectId");
    } else {
      params.set("projectId", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const header = (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <div className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Link project (optional)
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
    </header>
  );

  return (
    <div className="space-y-4">
      {header}
      <PreProductionToolPageImpl params={{ projectId: projectId || undefined, tool: toolSlug }} />
    </div>
  );
}

