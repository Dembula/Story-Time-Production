"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Film, ClipboardList, Users, MapPin, Wrench, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
};

const PRE_TOOLS = [
  {
    slug: "idea-development",
    label: "Idea Development",
    description: "Shape your concept, theme, and core promise.",
  },
  {
    slug: "script-writing",
    label: "Script Writing",
    description: "Draft and refine your script scene by scene.",
  },
  {
    slug: "script-review",
    label: "Script Review",
    description: "Run internal reviews or request an Executive Script Review.",
  },
  {
    slug: "script-breakdown",
    label: "Script Breakdown",
    description: "Tag scenes, characters, and elements for scheduling.",
  },
  {
    slug: "budget-builder",
    label: "Budget Builder",
    description: "Template-driven budget for your production.",
  },
  {
    slug: "production-scheduling",
    label: "Production Scheduling",
    description: "Turn your script into a shootable schedule.",
  },
  {
    slug: "casting-portal",
    label: "Casting",
    description: "Find and manage cast without leaving Story Time.",
    standaloneHref: "/creator/cast",
  },
  {
    slug: "crew-marketplace",
    label: "Crew",
    description: "Bring in crew from the marketplace.",
    standaloneHref: "/creator/crew",
  },
  {
    slug: "location-marketplace",
    label: "Locations",
    description: "Scout and lock locations for your shoot.",
    standaloneHref: "/creator/locations",
  },
  {
    slug: "visual-planning",
    label: "Visual Planning",
    description: "Moodboards and visual references per idea.",
  },
  {
    slug: "legal-contracts",
    label: "Legal & Contracts",
    description: "Create and track contracts for cast, crew, and vendors.",
  },
  {
    slug: "funding-hub",
    label: "Funding Hub",
    description: "Capture funding status, requests, and amounts.",
  },
  {
    slug: "pitch-deck-builder",
    label: "Pitch Deck Builder",
    description: "Generate and track a pitch deck for your project.",
  },
  {
    slug: "table-reads",
    label: "Table Reads",
    description: "Schedule table reads and capture notes.",
  },
  {
    slug: "production-workspace",
    label: "Production Workspace",
    description: "Central coordination hub for tasks and activity.",
  },
  {
    slug: "equipment-planning",
    label: "Equipment",
    description: "Plan cameras, lights, and gear needs.",
    standaloneHref: "/creator/equipment",
  },
  {
    slug: "risk-insurance",
    label: "Risk & Insurance",
    description: "Track what you need to be covered.",
  },
  {
    slug: "production-readiness",
    label: "Production Readiness",
    description: "Checklist before you move into Production.",
  },
] as const;

export default function CreatorPreProductionHub() {
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
              Pre-Production
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Jump straight into any pre-production tool for any project. Nothing is locked to a
              linear flow – you can move between tools and your work will follow the project.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Film className="w-4 h-4 text-orange-400" />
          Choose a project
        </h2>
        {isLoading ? (
          <Skeleton className="h-24 bg-slate-800/60" />
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
            You do not have any film projects yet. Create one from <Link href="/creator/dashboard" className="text-orange-400 hover:text-orange-300">My Projects</Link> and then come back here to jump into pre-production.
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
                  <ClipboardList className="w-3 h-3" />
                  Open project overview
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Jump into a pre-production tool
        </h2>
        <p className="text-xs text-slate-500">
          Pick a tool, then select the project you want to work on. All work is saved against that
          project and can be picked up from the project workspace later. Some tools (like Casting,
          Crew, Locations, and Equipment) can also be used in standalone mode without a project.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRE_TOOLS.map((tool) => {
            const hasProjects = projects.length > 0;
            const primaryHref =
              hasProjects && projects[0]
                ? `/creator/pre/${tool.slug}?projectId=${projects[0].id}`
                : `/creator/pre/${tool.slug}`;

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
                        href={`/creator/pre/${tool.slug}?projectId=${project.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 text-slate-200 hover:bg-orange-500 hover:text-white transition"
                      >
                        <Users className="w-3 h-3" />
                        {project.title}
                      </Link>
                    ))
                  ) : (tool as any).standaloneHref ? (
                    <Link
                      href={(tool as any).standaloneHref}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 text-slate-200 hover:bg-orange-500 hover:text-white transition"
                    >
                      <Wrench className="w-3 h-3" />
                      Open standalone
                    </Link>
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
          <MapPin className="w-4 h-4 text-sky-400" />
          Crew, cast, locations, equipment & catering
        </h2>
        <p className="text-xs text-slate-500">
          These marketplaces still live inside the pre-production tools (Casting, Crew, Locations, Equipment, Catering).
          Access them from the cards above instead of separate sidebar items.
        </p>
      </section>
    </div>
  );
}

