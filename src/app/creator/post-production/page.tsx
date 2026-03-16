"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Clapperboard, Sparkles, Music2, Package, UploadCloud } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
};

const POST_TOOLS = [
  {
    slug: "music-scoring",
    label: "Music & Scoring",
    description: "Pull tracks from the Story Time music library.",
  },
  {
    slug: "distribution",
    label: "Distribution",
    description: "Submit and hand off to Upload & delivery.",
  },
] as const;

export default function CreatorPostProductionHub() {
  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });

  const projects: Project[] = data?.projects ?? [];

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
              Post-Production
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Land wherever you need to: editing, sound, music, grading, packaging or distribution.
              Your work always rolls up into the same project, even if you jump around.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-violet-400" />
          Projects in post
        </h2>
        {isLoading ? (
          <Skeleton className="h-24 bg-slate-800/60" />
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
            No projects yet. Start with <Link href="/creator/dashboard" className="text-orange-400 hover:text-orange-300">My Projects</Link> and move a film into Post-Production to see it here.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="min-w-[220px] rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 flex flex-col justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-white truncate">{project.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {project.status} · {project.phase}
                  </p>
                </div>
                <Link
                  href={`/creator/dashboard?openProject=${project.id}`}
                  className="mt-3 inline-flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300"
                >
                  <Sparkles className="w-3 h-3" />
                  Open project overview
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Music2 className="w-4 h-4 text-emerald-400" />
          Jump into a post-production tool
        </h2>
        <p className="text-xs text-slate-500">
          Choose a tool and then the project. Film Packaging, Music &amp; Scoring, and Distribution
          are the same tools that appear in the project workspace sidebar – just surfaced here so you
          can reach them faster.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {POST_TOOLS.map((tool) => {
            const hasProjects = projects.length > 0;
            const primaryHref =
              tool.slug === "distribution"
                ? "/creator/upload"
                : hasProjects && projects[0]
                ? `/creator/post/${tool.slug}?projectId=${projects[0].id}`
                : `/creator/post/${tool.slug}`;

            return (
              <div
                key={tool.slug}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between hover:border-orange-500/60 hover:bg-slate-900 transition"
              >
                <Link href={primaryHref} className="space-y-1.5 block">
                  <p className="text-sm font-semibold text-white">{tool.label}</p>
                  <p className="text-xs text-slate-400">{tool.description}</p>
                </Link>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {tool.slug === "distribution" ? (
                    <span className="text-slate-500">
                      Go straight to the distribution upload flow.
                    </span>
                  ) : hasProjects ? (
                    projects.slice(0, 3).map((project) => (
                      <Link
                        key={project.id}
                        href={`/creator/post/${tool.slug}?projectId=${project.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 text-slate-200 hover:bg-orange-500 hover:text-white transition"
                      >
                        <Package className="w-3 h-3" />
                        {project.title}
                      </Link>
                    ))
                  ) : (
                    <span className="text-slate-500">
                      You can browse music now, or create a project from{" "}
                      <Link
                        href="/creator/dashboard"
                        className="text-orange-400 hover:text-orange-300"
                      >
                        My Projects
                      </Link>
                      .
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-sky-400" />
          Upload &amp; delivery
        </h2>
        <p className="text-xs text-slate-500">
          When you are ready to hand off, use the <span className="font-medium text-slate-200">Distribution</span> tool here or inside a project.
          That will route you into the same Upload &amp; delivery flow – there is no separate Upload
          menu item needed in the sidebar.
        </p>
      </section>
    </div>
  );
}

