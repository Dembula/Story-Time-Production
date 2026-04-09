"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjectToolHref,
  type ProjectPhase,
  type ProjectToolMeta,
} from "@/lib/project-tools";
import { CreatorToolNavCard } from "@/components/creator/creator-tool-nav-card";

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
};

function standaloneToolHref(phase: ProjectPhase, slug: string): string {
  if (phase === "PRE_PRODUCTION") {
    const map: Record<string, string> = {
      "casting-portal": "/creator/cast",
      "crew-marketplace": "/creator/crew",
      "location-marketplace": "/creator/locations",
      "equipment-planning": "/creator/equipment",
    };
    return map[slug] ?? `/creator/pre/${slug}`;
  }
  if (phase === "PRODUCTION") {
    return `/creator/production/${slug}`;
  }
  if (slug === "distribution") return "/creator/upload";
  if (slug === "footage-ingestion") return "/creator/post/footage-ingestion";
  if (slug === "music-scoring") return "/creator/music";
  return "/creator/dashboard";
}

export function CreatorPhaseHub({
  phase,
  eyebrow,
  title,
  description,
  tools,
  sectionToolsTitle = "Jump into a tool",
  sectionToolsLead,
  sectionProjectsTitle = "Choose a project",
  footerSection,
  ProjectsIcon,
}: {
  phase: ProjectPhase;
  eyebrow: string;
  title: string;
  description: string;
  tools: ProjectToolMeta[];
  sectionToolsTitle?: string;
  sectionToolsLead?: string;
  sectionProjectsTitle?: string;
  footerSection?: React.ReactNode;
  ProjectsIcon?: LucideIcon;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });

  const projects: Project[] = data?.projects ?? [];
  const PIcon = ProjectsIcon ?? ClipboardList;

  const projectHref = (tool: ProjectToolMeta, projectId: string) =>
    getProjectToolHref(projectId, { phase, toolSlug: tool.toolSlug });

  const primaryHref = (tool: ProjectToolMeta) =>
    projects[0]
      ? projectHref(tool, projects[0].id)
      : standaloneToolHref(phase, tool.toolSlug);

  return (
    <div className="space-y-8">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">{eyebrow}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">{description}</p>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <PIcon className="h-4 w-4 text-orange-400" />
          {sectionProjectsTitle}
        </h2>
        {isLoading ? (
          <Skeleton className="h-24 bg-white/[0.06]" />
        ) : projects.length === 0 ? (
          <div className="storytime-empty-state p-6 text-sm text-slate-400">
            No projects yet. Create one from{" "}
            <Link href="/creator/dashboard" className="text-orange-400 hover:text-orange-300">
              My Projects
            </Link>{" "}
            to link tools to a film.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="creator-glass-panel flex min-w-[220px] flex-col justify-between px-4 py-3 transition hover:border-orange-400/25"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{project.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {project.status} · {project.phase}
                  </p>
                </div>
                <Link
                  href={`/creator/dashboard?openProject=${project.id}`}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-orange-300 hover:text-orange-200"
                >
                  <ClipboardList className="h-3 w-3 shrink-0" />
                  Open pipeline
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">{sectionToolsTitle}</h2>
        {sectionToolsLead ? <p className="text-xs text-slate-500">{sectionToolsLead}</p> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <div key={tool.id} className="flex flex-col gap-3">
              <CreatorToolNavCard
                hub
                href={primaryHref(tool)}
                label={tool.label}
                description={tool.description}
              />
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex flex-wrap gap-2">
                  {projects.length > 0 ? (
                    projects.slice(0, 5).map((project) => (
                      <Link
                        key={project.id}
                        href={projectHref(tool, project.id)}
                        className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-slate-200 transition hover:border-orange-400/35 hover:bg-orange-500/10"
                      >
                        Workspace · {project.title}
                      </Link>
                    ))
                  ) : tool.toolSlug === "distribution" && phase === "POST_PRODUCTION" ? (
                  <span className="text-slate-500">
                    Use{" "}
                    <Link href="/creator/upload" className="text-orange-400 hover:text-orange-300">
                      Upload
                    </Link>{" "}
                    or create a project first.
                  </span>
                ) : (
                  <Link
                    href={standaloneToolHref(phase, tool.toolSlug)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] px-2.5 py-1 text-slate-300 hover:border-orange-400/30 hover:text-white"
                  >
                    Open without project
                  </Link>
                )}
                </div>
                {tool.toolSlug === "distribution" && phase === "POST_PRODUCTION" && projects.length > 0 && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Catalogue delivery (linked flow)
                    </p>
                    <p className="mb-2 text-[11px] text-slate-500">
                      Same 6-step catalogue wizard — adds a linked-project banner and notes the project on your submission
                      for reviewers.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {projects.slice(0, 6).map((project) => (
                        <Link
                          key={`up-${project.id}`}
                          href={`/creator/upload?projectId=${project.id}`}
                          className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-sky-200 transition hover:border-sky-400/40 hover:bg-sky-500/15"
                        >
                          Upload · {project.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {footerSection}
    </div>
  );
}
