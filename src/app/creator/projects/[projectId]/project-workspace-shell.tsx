 "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { useState, ReactNode } from "react";
import {
  PRE_PRODUCTION_TOOLS,
  PRODUCTION_TOOLS,
  POST_PRODUCTION_TOOLS,
} from "@/lib/project-tools";

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
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [preOpen, setPreOpen] = useState(true);
  const [prodOpen, setProdOpen] = useState(true);
  const [postOpen, setPostOpen] = useState(true);

  const stage = project.status || "DEVELOPMENT";
  const phase = project.phase || "CONCEPT";

  const progress = stage === "DEVELOPMENT" ? 25 : stage === "PRODUCTION" ? 65 : 90;

  const basePath = `/creator/projects/${project.id}`;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-[calc(100vh-120px)] flex gap-6">
      {sidebarOpen && (
        <aside className="w-64 shrink-0 rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <Link
            href={`${basePath}/overview`}
            className={[
              "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition",
              isActive(`${basePath}/overview`)
                ? "bg-orange-500 text-white"
                : "bg-slate-800/60 text-slate-200 hover:bg-slate-800",
            ].join(" ")}
          >
            <span>Overview</span>
          </Link>

          <Section
            title="Pre-Production"
            open={preOpen}
            onToggle={() => setPreOpen((v) => !v)}
          >
            {PRE_PRODUCTION_TOOLS.map((tool) => {
              const href = `${basePath}/pre-production/${tool.toolSlug}`;
              return (
                <SidebarLink key={tool.id} href={href} active={isActive(href)}>
                  {tool.label}
                </SidebarLink>
              );
            })}
          </Section>

          <Section
            title="Production"
            open={prodOpen}
            onToggle={() => setProdOpen((v) => !v)}
          >
            {PRODUCTION_TOOLS.map((tool) => {
              const href = `${basePath}/production/${tool.toolSlug}`;
              return (
                <SidebarLink key={tool.id} href={href} active={isActive(href)}>
                  {tool.label}
                </SidebarLink>
              );
            })}
          </Section>

          <Section
            title="Post-Production"
            open={postOpen}
            onToggle={() => setPostOpen((v) => !v)}
          >
            {POST_PRODUCTION_TOOLS.map((tool) => {
              const href = `${basePath}/post-production/${tool.toolSlug}`;
              return (
                <SidebarLink key={tool.id} href={href} active={isActive(href)}>
                  {tool.label}
                </SidebarLink>
              );
            })}
          </Section>
        </aside>
      )}

      <section className="flex-1 min-w-0 space-y-4">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
            aria-label="Show project menu"
          >
            <PanelLeftOpen className="w-3 h-3" />
            Show project menu
          </button>
        )}

        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="mt-1 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                aria-label={sidebarOpen ? "Hide project menu" : "Show project menu"}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" />
                )}
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-white">{project.title}</h1>
                  {project.isOriginal && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/40">
                      Story Time Original
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Stage: <span className="font-medium text-slate-200">{stage}</span> · Phase:{" "}
                  <span className="font-medium text-slate-200">{phase}</span>
                </p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Production progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                {project.adminNote && (
                  <div className="mt-3 inline-flex items-start gap-2 rounded-lg bg-orange-500/5 border border-orange-500/30 px-3 py-2">
                    <span className="text-[11px] font-semibold text-orange-300">Admin note</span>
                    <span className="text-[11px] text-slate-200">{project.adminNote}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-xs text-slate-400">
              <div className="flex flex-wrap justify-end gap-2">
                {project.members.slice(0, 4).map((m) => (
                  <span
                    key={m.id}
                    className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200"
                  >
                    {m.user.name || "Member"} · {m.role}
                  </span>
                ))}
                {project.members.length > 4 && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    +{project.members.length - 4} more
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <QuickAction href={`${basePath}/pre-production/production-workspace`}>
                  Open Production Workspace
                </QuickAction>
                <QuickAction href={`${basePath}/pre-production/legal-contracts`}>
                  View Contracts
                </QuickAction>
                <QuickAction href={`${basePath}/post-production/distribution`}>
                  Go to Distribution
                </QuickAction>
              </div>
            </div>
          </div>
        </header>

        <div>{children}</div>
      </section>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/70 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wide text-slate-200 hover:bg-slate-800/80"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="border-t border-slate-800 bg-slate-950/40">{children}</div>
      )}
    </div>
  );
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "block px-3 py-1.5 text-xs transition",
        active
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:text-white hover:bg-slate-900/80",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function QuickAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-full border border-slate-700 text-[11px] text-slate-200 hover:bg-slate-800 hover:border-slate-500 transition"
    >
      {children}
    </Link>
  );
}
