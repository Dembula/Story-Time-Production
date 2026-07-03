"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { AdminProjectReviewDigest } from "@/components/admin/admin-project-review-digest";
import { resolveNetworkDisplayName } from "@/lib/network-display-name";

export type AdminProjectListItem = {
  id: string;
  title: string;
  logline: string | null;
  type: string;
  genre: string | null;
  status: string;
  phase: string;
  createdAt: string;
  updatedAt: string;
  toolsComplete: number;
  toolsTracked: number;
  toolsInProgress: number;
  toolsSkipped: number;
  progressPercent: number;
  linkedCatalogueCount: number;
  memberCount: number;
  activeMemberCount: number;
  invitedMemberCount: number;
  memberPreview: string[];
  leadCreator: {
    id: string;
    name: string | null;
    email: string | null;
    networkHandle: string | null;
  } | null;
  originalTone: "greenlit" | "pending" | null;
};

function leadLabel(lead: AdminProjectListItem["leadCreator"]) {
  if (!lead) return "Unknown creator";
  return resolveNetworkDisplayName(lead);
}

export function AdminProjectsClient({ projects }: { projects: AdminProjectListItem[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (!hash.startsWith("project-")) return;
    const id = hash.slice("project-".length);
    if (projects.some((p) => p.id === id)) setOpenId(id);
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const hay = [
        p.title,
        p.logline,
        p.type,
        p.genre,
        p.status,
        p.phase,
        p.leadCreator?.name,
        p.leadCreator?.email,
        p.leadCreator?.networkHandle,
        ...p.memberPreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects, creators, emails, handles…"
          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-orange-500/50 focus:outline-none"
        />
      </div>

      <p className="text-xs text-slate-500">
        {filtered.length} project{filtered.length === 1 ? "" : "s"}
        {query.trim() ? ` matching “${query.trim()}”` : ""} · expand a row for the full dossier
      </p>

      <div className="space-y-3">
        {filtered.map((project) => {
          const open = openId === project.id;
          const created = new Date(project.createdAt);
          const updated = new Date(project.updatedAt);

          return (
            <div
              key={project.id}
              id={`project-${project.id}`}
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"
            >
              <button
                type="button"
                onClick={() => setOpenId((cur) => (cur === project.id ? null : project.id))}
                className="flex w-full flex-col gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2">
                  {open ? (
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-white">{project.title}</p>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {project.status}
                      </span>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                        {project.phase}
                      </span>
                      {project.originalTone === "greenlit" && (
                        <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">
                          Story Time Original
                        </span>
                      )}
                      {project.originalTone === "pending" && (
                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                          Originals application
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-1 text-xs text-slate-400">
                      {project.logline || "No logline yet."}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Lead: {leadLabel(project.leadCreator)}
                      {project.leadCreator?.networkHandle
                        ? ` (@${project.leadCreator.networkHandle})`
                        : ""}
                      {project.leadCreator?.email ? ` · ${project.leadCreator.email}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Created {created.toLocaleDateString()} · Updated {updated.toLocaleDateString()} ·{" "}
                      {project.type}
                      {project.genre ? ` · ${project.genre}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1 pl-6 text-[11px] text-slate-400 sm:items-end sm:pl-0 sm:text-right">
                  <span>
                    Pipeline{" "}
                    <span className="text-slate-200">{project.progressPercent}%</span>
                    {" · "}
                    <span className="text-slate-200">
                      {project.toolsComplete}/{project.toolsTracked}
                    </span>{" "}
                    tools
                    {project.toolsSkipped > 0 ? ` · ${project.toolsSkipped} skipped` : ""}
                    {project.toolsInProgress > 0 ? ` · ${project.toolsInProgress} in progress` : ""}
                  </span>
                  <span>
                    Team:{" "}
                    <span className="text-slate-200">{project.activeMemberCount}</span>
                    {project.invitedMemberCount > 0
                      ? ` · ${project.invitedMemberCount} invited`
                      : ""}
                    {project.memberPreview.length > 0
                      ? ` · ${project.memberPreview.slice(0, 2).join(", ")}`
                      : ""}
                  </span>
                  <span>
                    Linked catalogue:{" "}
                    <span className="text-slate-200">{project.linkedCatalogueCount}</span>
                  </span>
                  <span className="text-slate-500">{open ? "Hide details" : "Show full dossier"}</span>
                </div>
              </button>

              {open && (
                <div className="border-t border-slate-800 bg-black/25 px-3 py-4 sm:px-4">
                  <AdminProjectReviewDigest projectId={project.id} hideProjectsLink />
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-slate-400">
            {projects.length === 0
              ? "No projects found yet. When creators submit Originals and use the production pipeline, they will appear here."
              : "No projects match your search."}
          </p>
        )}
      </div>
    </div>
  );
}
