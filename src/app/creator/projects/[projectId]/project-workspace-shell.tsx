"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";

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
  children: ReactNode;
}

export function ProjectWorkspaceShell({ project, children }: ProjectWorkspaceShellProps) {
  const stage = project.status || "DEVELOPMENT";
  const phase = project.phase || "CONCEPT";

  const progress = stage === "DEVELOPMENT" ? 25 : stage === "PRODUCTION" ? 65 : 90;

  const basePath = `/creator/projects/${project.id}`;

  return (
    <div className="min-h-[calc(100vh-120px)] space-y-5">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
                Project workspace
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  {project.title}
                </h1>
                {project.isOriginal && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/40">
                    Story Time Original
                  </span>
                )}
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
          <div className="flex flex-col items-stretch gap-3 text-xs text-slate-400 sm:items-end">
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
            <div className="flex flex-col gap-2 sm:max-w-[14rem] sm:items-stretch">
              <QuickAction href={`${basePath}/pre-production/production-workspace`}>
                Production workspace
              </QuickAction>
              <QuickAction href={`${basePath}/pre-production/legal-contracts`}>
                Legal &amp; contracts
              </QuickAction>
              <QuickAction href={`${basePath}/post-production/distribution`}>
                Distribution
              </QuickAction>
            </div>
          </div>
        </div>
      </header>

      <div className="storytime-section p-5 md:p-6">{children}</div>
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
