"use client";

import Link from "next/link";
import { ReactNode } from "react";
import type { CreatorSuiteAccessMap } from "@/lib/creator-suite-access";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";
import { LayoutDashboard } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

type OriginalMember = {
  id: string;
  role: string;
  user: { id: string; name: string | null };
};

type OriginalProject = {
  id: string;
  title: string;
  status: string;
  phase: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  members: OriginalMember[];
  isOriginal?: boolean;
  adminNote?: string | null;
};

interface ProjectWorkspaceShellProps {
  project: OriginalProject;
  switchableProjects: { id: string; title: string }[];
  /** Full pipeline plan: show pre/production shortcuts; upload-only sees distribution only. */
  pipelineAccess?: boolean;
  /** Per-suite entitlements (license ∩ team invite mask). */
  suiteAccess?: CreatorSuiteAccessMap;
  children: ReactNode;
}

export function ProjectWorkspaceShell({
  project,
  switchableProjects,
  pipelineAccess = true,
  suiteAccess: suiteAccessProp,
  children,
}: ProjectWorkspaceShellProps) {
  const { deviceClass } = useAdaptiveUi();
  const suiteAccess = suiteAccessProp ?? defaultSuiteAccessOpen();
  const showPreShortcuts = pipelineAccess && suiteAccess.pipeline_pre;
  const showDistributionShortcut = suiteAccess.catalogue_upload || suiteAccess.pipeline_post;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = project.status || "DEVELOPMENT";
  const phase = project.phase || "CONCEPT";

  const progress = stage === "DEVELOPMENT" ? 25 : stage === "PRODUCTION" ? 65 : 90;

  const basePath = `/creator/projects/${project.id}`;
  const currentProjectPrefix = `/creator/projects/${project.id}`;
  const handleProjectSwitch = (nextProjectId: string) => {
    if (!nextProjectId || nextProjectId === project.id) return;
    const nextProjectPrefix = `/creator/projects/${nextProjectId}`;
    const nextPath = pathname.startsWith(currentProjectPrefix)
      ? pathname.replace(currentProjectPrefix, nextProjectPrefix)
      : `${nextProjectPrefix}/overview`;
    const qs = searchParams.toString();
    router.push(qs ? `${nextPath}?${qs}` : nextPath);
  };

  return (
    <div className={`min-h-[calc(100vh-120px)] space-y-5 adaptive-content-density ${deviceClass === "tv" ? "adaptive-tv-surface" : ""}`}>
      <header className={`storytime-plan-card ${deviceClass === "mobile" ? "p-4" : "p-5 md:p-6"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
                Project workspace
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={`font-display font-semibold tracking-tight text-white ${deviceClass === "tv" ? "text-4xl" : "text-2xl md:text-3xl"}`}>
                  {project.title}
                </h1>
                {project.isOriginal && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/40">
                    Story Time Original
                  </span>
                )}
              </div>
              <div className="mt-3 inline-flex max-w-xs flex-col gap-1">
                <label
                  htmlFor="project-switcher"
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500"
                >
                  Active project
                </label>
                <select
                  id="project-switcher"
                  value={project.id}
                  onChange={(e) => handleProjectSwitch(e.target.value)}
                  className="rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-orange-400/60"
                >
                  {switchableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Stage: <span className="font-medium text-slate-200">{stage}</span> · Phase:{" "}
                <span className="font-medium text-slate-200">{phase}</span>
              </p>
              <div className="mt-4 max-w-xl">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Production progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              {project.adminNote && (
                <div className="mt-4 inline-flex max-w-2xl items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/8 px-3 py-2">
                  <span className="text-[11px] font-semibold text-orange-300">Admin note</span>
                  <span className="text-[11px] text-slate-200">{project.adminNote}</span>
                </div>
              )}
            </div>
          </div>
          <div className={`flex flex-col items-stretch gap-3 text-xs text-slate-400 ${deviceClass === "mobile" ? "w-full" : "sm:items-end"}`}>
            <Link
              href={`/creator/dashboard?openProject=${project.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-400/35 bg-orange-500/10 px-4 py-2.5 text-xs font-medium text-orange-100 transition hover:border-orange-400/50 hover:bg-orange-500/15"
            >
              <LayoutDashboard className="h-4 w-4" />
              My Projects
            </Link>
            <div className="flex flex-wrap justify-end gap-2">
              {project.members.slice(0, 4).map((m) => (
                <span
                  key={m.id}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-slate-200"
                >
                  {m.user.name || "Member"} · {m.role}
                </span>
              ))}
              {project.members.length > 4 && (
                <span className="rounded-full border border-white/[0.06] bg-black/20 px-2.5 py-0.5 text-slate-400">
                  +{project.members.length - 4} more
                </span>
              )}
            </div>
            <p className="hidden text-[11px] uppercase tracking-wide text-slate-500 sm:block">Shortcuts</p>
            <div className={`flex gap-2 ${deviceClass === "mobile" ? "flex-row flex-wrap" : "flex-col sm:max-w-[14rem] sm:items-stretch"}`}>
              {showPreShortcuts ? (
                <>
                  <QuickAction href={`${basePath}/pre-production/production-workspace`}>
                    Production workspace
                  </QuickAction>
                  <QuickAction href={`${basePath}/pre-production/legal-contracts`}>
                    Legal &amp; contracts
                  </QuickAction>
                </>
              ) : null}
              {showDistributionShortcut ? (
                <QuickAction href={`${basePath}/post-production/distribution`}>Distribution</QuickAction>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className={`storytime-section ${deviceClass === "mobile" ? "p-4" : "p-5 md:p-6"}`}>{children}</div>
    </div>
  );
}

function QuickAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="storytime-plan-card block px-4 py-2.5 text-center text-[12px] font-medium text-slate-100 transition duration-200 hover:-translate-y-0.5 hover:border-white/15"
    >
      {children}
    </Link>
  );
}
