"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Camera, Clapperboard, ClipboardCheck, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
};

const PROD_TOOLS = [
  {
    slug: "control-center",
    label: "Production Control Center",
    description: "High-level view of your shoot days and status.",
  },
  {
    slug: "call-sheet-generator",
    label: "Call Sheet Generator",
    description: "Build and share call sheets for cast and crew.",
  },
  {
    slug: "on-set-tasks",
    label: "On-Set Task Management",
    description: "Track what needs to happen on set in real time.",
  },
  {
    slug: "equipment-tracking",
    label: "Equipment Tracking",
    description: "Know where your cameras, lenses, and gear are.",
  },
  {
    slug: "shoot-progress",
    label: "Shoot Progress Tracker",
    description: "See how far through the schedule you are.",
  },
  {
    slug: "continuity-manager",
    label: "Continuity Manager",
    description: "Continuity notes by scene and shoot day.",
  },
  {
    slug: "dailies-review",
    label: "Dailies Review",
    description: "Dailies batches and review notes.",
  },
  {
    slug: "expense-tracker",
    label: "Production Expense Tracker",
    description: "Track actual expenses against budget.",
  },
  {
    slug: "incident-reporting",
    label: "Incident Reporting",
    description: "Capture and track any incidents on set.",
  },
  {
    slug: "wrap",
    label: "Production Wrap",
    description: "Mark the shoot complete and hand over to Post.",
  },
] as const;

export default function CreatorProductionHub() {
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
              Production
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Open any on-set tool for any project. You can jump in at the point that makes sense
              for your shoot – Story Time keeps the underlying project connected.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-400" />
          Active projects
        </h2>
        {isLoading ? (
          <Skeleton className="h-24 bg-slate-800/60" />
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
            No projects yet. Start a film from <Link href="/creator/dashboard" className="text-orange-400 hover:text-orange-300">My Projects</Link> to unlock production tools.
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
                  <Clapperboard className="w-3 h-3" />
                  Open project overview
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-sky-400" />
          Jump into a production tool
        </h2>
        <p className="text-xs text-slate-500">
          Pick a tool below, then choose the project you want to work on. Everything you log here
          is tied back to that project and visible in the project workspace.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROD_TOOLS.map((tool) => {
            const hasProjects = projects.length > 0;
            const primaryHref =
              hasProjects && projects[0]
                ? `/creator/production/${tool.slug}?projectId=${projects[0].id}`
                : `/creator/production/${tool.slug}`;

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
                  {hasProjects ? (
                    projects.slice(0, 3).map((project) => (
                      <Link
                        key={project.id}
                        href={`/creator/production/${tool.slug}?projectId=${project.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 text-slate-200 hover:bg-orange-500 hover:text-white transition"
                      >
                        <Clapperboard className="w-3 h-3" />
                        {project.title}
                      </Link>
                    ))
                  ) : (
                    <span className="text-slate-500">
                      You can start in this tool without a project, or create one from{" "}
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
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          Staying flexible
        </h2>
        <p className="text-xs text-slate-500">
          You never have to complete production tools in order. You can jump between call sheets,
          incident reports, and progress tracking – Story Time keeps your work attached to the same
          project under the hood.
        </p>
      </section>
    </div>
  );
}

