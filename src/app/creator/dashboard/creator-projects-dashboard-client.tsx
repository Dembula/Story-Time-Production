"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Plus, Users, Clock, Film, ChevronDown, ChevronRight, CheckCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PRE_PRODUCTION_TOOLS,
  PRODUCTION_TOOLS,
  POST_PRODUCTION_HUB_TOOLS,
  getProjectToolHref,
  type ProjectPhase,
} from "@/lib/project-tools";
import { CreatorToolNavCard, type CreatorToolNavStatus } from "@/components/creator/creator-tool-nav-card";

type ToolProgress = { toolId: string; phase: string; status: string; percent: number };

type Project = {
  id: string;
  title: string;
  status: string;
  phase: string;
  genre: string | null;
  updatedAt: string;
  members: { id: string }[];
  projectToolProgress?: ToolProgress[];
  ideasCount?: number;
  isOriginal?: boolean;
};

type NetworkCreator = {
  id: string;
  name: string | null;
  image: string | null;
  following: boolean;
  connectionStatus?: string;
};

function toolHref(phase: ProjectPhase, toolSlug: string, projectId: string): string {
  return getProjectToolHref(projectId, { phase, toolSlug });
}

const TRACKED_TOOL_IDS = new Set<string>([
  ...PRE_PRODUCTION_TOOLS.map((t) => t.id),
  ...PRODUCTION_TOOLS.map((t) => t.id),
  ...POST_PRODUCTION_HUB_TOOLS.map((t) => t.id),
]);

/** Maps DB phase to pipeline step 1–3 for UI emphasis. */
function pipelineStepFromPhase(phase: string): 1 | 2 | 3 {
  if (phase === "POST_PRODUCTION") return 3;
  if (phase === "PRODUCTION") return 2;
  return 1;
}

type ContentListRow = {
  id: string;
  title: string;
  reviewStatus: string;
  linkedProjectId?: string | null;
};

type LinkedCatalogueChip = { id: string; reviewStatus: string; title: string };

function pickLinkedCatalogue(projectId: string, contents: ContentListRow[]): LinkedCatalogueChip | null {
  const tracked = ["PENDING", "REJECTED", "CHANGES_REQUESTED"];
  const rows = contents.filter((c) => c.linkedProjectId === projectId && tracked.includes(c.reviewStatus));
  if (rows.length === 0) return null;
  const rank = (s: string) => (s === "REJECTED" ? 3 : s === "CHANGES_REQUESTED" ? 2 : 1);
  rows.sort((a, b) => rank(b.reviewStatus) - rank(a.reviewStatus));
  const top = rows[0];
  return { id: top.id, reviewStatus: top.reviewStatus, title: top.title };
}

function catalogueChipStyle(status: string): string {
  if (status === "REJECTED") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (status === "CHANGES_REQUESTED") return "border-orange-500/40 bg-orange-500/10 text-orange-200";
  return "border-amber-500/35 bg-amber-500/10 text-amber-100";
}

function catalogueChipLabel(status: string): string {
  if (status === "REJECTED") return "Catalogue rejected";
  if (status === "CHANGES_REQUESTED") return "Catalogue: changes requested";
  return "Catalogue in review";
}

function ProjectRow({
  project,
  defaultOpen = false,
  linkedCatalogue,
}: {
  project: Project;
  defaultOpen?: boolean;
  linkedCatalogue: LinkedCatalogueChip | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (defaultOpen && open && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [defaultOpen, open]);
  const progress = project.projectToolProgress ?? [];
  const progressMap = new Map(progress.map((p) => [p.toolId, p]));
  const ideasCount = project.ideasCount ?? 0;

  const updated = new Date(project.updatedAt);
  const stage = project.status || "DEVELOPMENT";
  const activeStep = pipelineStepFromPhase(project.phase);

  const completedTracked = progress.filter((p) => TRACKED_TOOL_IDS.has(p.toolId) && p.status === "COMPLETE").length;
  const ideaExtra =
    ideasCount > 0 && progressMap.get("idea-development")?.status !== "COMPLETE" ? 1 : 0;
  const doneCount = completedTracked + ideaExtra;
  const totalTools =
    PRE_PRODUCTION_TOOLS.length + PRODUCTION_TOOLS.length + POST_PRODUCTION_HUB_TOOLS.length;
  const progressPct = totalTools > 0 ? Math.round((doneCount / totalTools) * 100) : 0;

  function phaseDoneTotal(
    tools: { id: string; label: string; description: string; toolSlug: string; phase: ProjectPhase }[],
  ): { done: number; total: number } {
    let done = 0;
    for (const t of tools) {
      const prog = progressMap.get(t.id);
      const isIdea = t.id === "idea-development" && ideasCount > 0;
      if (prog?.status === "COMPLETE" || isIdea) done += 1;
    }
    return { done, total: tools.length };
  }

  const pre = phaseDoneTotal(
    PRE_PRODUCTION_TOOLS.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      toolSlug: t.toolSlug,
      phase: t.phase,
    })),
  );
  const prod = phaseDoneTotal(
    PRODUCTION_TOOLS.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      toolSlug: t.toolSlug,
      phase: t.phase,
    })),
  );
  const post = phaseDoneTotal(
    POST_PRODUCTION_HUB_TOOLS.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      toolSlug: t.toolSlug,
      phase: t.phase,
    })),
  );

  const renderSection = (
    eyebrow: string,
    title: string,
    stepNum: 1 | 2 | 3,
    phaseSummary: { done: number; total: number },
    tools: { id: string; label: string; description: string; toolSlug: string; phase: ProjectPhase }[],
  ) => {
    if (tools.length === 0) return null;
    const isCurrent = activeStep === stepNum;
    return (
      <div
        className={[
          "rounded-2xl border p-5 md:p-6 lg:p-8",
          isCurrent
            ? "border-orange-500/40 bg-orange-500/[0.06] shadow-[0_0_0_1px_rgba(249,115,22,0.12)]"
            : "border-white/10 bg-slate-900/40",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4 mb-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">{eyebrow}</p>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-white">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {phaseSummary.done} / {phaseSummary.total} tools marked complete · opens in project workspace
            </p>
          </div>
          {isCurrent ? (
            <span className="shrink-0 rounded-full bg-orange-500/20 px-3 py-1 text-[11px] font-semibold text-orange-200">
              Current phase
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-500">
              Step {stepNum}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {tools.map((t) => {
            const prog = progressMap.get(t.id);
            const isIdeaLinked = t.id === "idea-development" && ideasCount > 0;
            const done = prog?.status === "COMPLETE" || isIdeaLinked;
            const inProgress = prog?.status === "IN_PROGRESS";
            let status: CreatorToolNavStatus = "not_started";
            if (done) status = isIdeaLinked && prog?.status !== "COMPLETE" ? "linked" : "done";
            else if (inProgress) status = "in_progress";
            const href = toolHref(t.phase, t.toolSlug, project.id);
            return (
              <CreatorToolNavCard
                key={t.id}
                href={href}
                label={t.label}
                description={t.description}
                status={status}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const pipelineSteps: { id: 1 | 2 | 3; label: string }[] = [
    { id: 1, label: "Pre-production" },
    { id: 2, label: "Production" },
    { id: 3, label: "Post-production" },
  ];

  return (
    <div ref={rowRef} id={`project-${project.id}`} className="storytime-plan-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.03] md:flex-row md:items-center md:justify-between md:gap-6"
      >
        <div className="min-w-0 flex flex-1 items-start gap-3">
          {open ? <ChevronDown className="mt-1 w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="mt-1 w-5 h-5 text-slate-400 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-semibold text-white md:text-xl">{project.title}</p>
              <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] text-slate-200">{stage}</span>
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400">{project.phase}</span>
              {project.isOriginal && (
                <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-0.5 text-[11px] text-orange-300">
                  Original
                </span>
              )}
              {linkedCatalogue && (
                <Link
                  href={`/creator/catalogue/reviews/${linkedCatalogue.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={[
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition hover:brightness-110",
                    catalogueChipStyle(linkedCatalogue.reviewStatus),
                  ].join(" ")}
                >
                  {catalogueChipLabel(linkedCatalogue.reviewStatus)}
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-400">
              {project.genre || "Unspecified genre"} · Last edited {updated.toLocaleDateString()}
            </p>
            {/* Stepper aligned with project.phase */}
            <div className="flex flex-wrap items-center gap-2">
              {pipelineSteps.map((s, idx) => {
                const reached = activeStep >= s.id;
                const current = activeStep === s.id;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                        current
                          ? "border-orange-500/50 bg-orange-500/15 text-orange-100"
                          : reached
                            ? "border-green-500/30 bg-green-500/10 text-green-300"
                            : "border-white/10 bg-white/[0.03] text-slate-500",
                      ].join(" ")}
                    >
                      {reached && !current ? (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
                      ) : (
                        <Circle className={`h-3.5 w-3.5 shrink-0 ${current ? "text-orange-400" : "text-slate-600"}`} />
                      )}
                      {s.label}
                    </span>
                    {idx < pipelineSteps.length - 1 && <span className="hidden text-slate-600 sm:inline">→</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Pipeline {doneCount}/{totalTools} tracked tools
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {project.members.length + 1} team member{project.members.length + 1 !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-48 md:shrink-0">
          <span className="text-xs text-slate-500 md:text-right">{open ? "Hide" : "Show"} full pipeline</span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 md:text-right">{progressPct}% overall</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/[0.08] bg-black/25 px-4 py-6 md:px-6 md:py-8 lg:px-10 lg:py-10">
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-400">
            Each phase stacks below — only <span className="text-slate-300">Music &amp; scoring</span> and{" "}
            <span className="text-slate-300">Distribution</span> count in post-production tracking. Tool status comes from
            your saves inside each workspace.
          </p>
          <div className="flex flex-col gap-8 lg:gap-10">
            {renderSection("Phase 1", "Pre-production", 1, pre, PRE_PRODUCTION_TOOLS.map((t) => ({
              id: t.id,
              label: t.label,
              description: t.description,
              toolSlug: t.toolSlug,
              phase: t.phase,
            })))}
            {renderSection("Phase 2", "Production", 2, prod, PRODUCTION_TOOLS.map((t) => ({
              id: t.id,
              label: t.label,
              description: t.description,
              toolSlug: t.toolSlug,
              phase: t.phase,
            })))}
            {renderSection(
              "Phase 3",
              "Post-production",
              3,
              post,
              POST_PRODUCTION_HUB_TOOLS.map((t) => ({
                id: t.id,
                label: t.label,
                description: t.description,
                toolSlug: t.toolSlug,
                phase: t.phase,
              })),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreatorProjectsDashboardClient() {
  const searchParams = useSearchParams();
  const openProjectId = searchParams.get("openProject");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["creator-projects"],
    queryFn: () => fetch("/api/creator/projects").then((r) => r.json()),
  });

  const { data: contentListRaw } = useQuery({
    queryKey: ["creator-content-dashboard"],
    queryFn: () => fetch("/api/creator/content").then((r) => r.json()),
  });
  const contents: ContentListRow[] = Array.isArray(contentListRaw) ? contentListRaw : [];

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("FEATURE_FILM");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState("");
  const [isCollaboration, setIsCollaboration] = useState(false);
  const [networkCreators, setNetworkCreators] = useState<NetworkCreator[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          logline,
          genre,
          isOriginal: true,
          isCollaboration,
          collaboratorIds: isCollaboration ? selectedCollaborators : [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => {
      setCreating(false);
      setTitle("");
      setLogline("");
      setGenre("");
      setIsCollaboration(false);
      setSelectedCollaborators([]);
      queryClient.invalidateQueries({ queryKey: ["creator-projects"] });
    },
  });

  const projects: Project[] = data?.projects ?? [];

  useEffect(() => {
    if (!creating || !isCollaboration) return;
    fetch("/api/network/creators")
      .then((r) => r.json())
      .then((d) => {
        const all: NetworkCreator[] = d.creators ?? [];
        const connected = all.filter(
          (c) =>
            (c.following || c.connectionStatus === "ACCEPTED") &&
            c.id !== (data?.meId ?? null)
        );
        setNetworkCreators(connected);
      })
      .catch(() => setNetworkCreators([]));
  }, [creating, isCollaboration]);

  const toggleCollaborator = (id: string) => {
    setSelectedCollaborators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-10">
      <header className="storytime-plan-card p-5 md:p-6 lg:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Creator pipeline</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">My Projects</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
              Same rhythm as Distribution upload: one clear flow per project. Expand a film to see all three phases in a
              vertical stack — progress counts only tools we ship (including Music + Distribution in post).
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 self-start sm:flex-row sm:items-center md:self-center">
            <Link
              href="/creator/upload"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-orange-400/35 hover:bg-orange-500/10 hover:text-white"
            >
              Catalogue upload
            </Link>
            <Button onClick={() => setCreating(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
        </div>
      </header>

      {creating && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Create a new film project</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Working title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="e.g. The Last Light"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="storytime-select rounded-xl px-3 py-2"
              >
                <option value="SHORT_FILM">Short film</option>
                <option value="INDIE_FILM">Indie film</option>
                <option value="FEATURE_FILM">Feature film</option>
                <option value="TV_EPISODE">TV episode</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-400">Logline</label>
              <input
                value={logline}
                onChange={(e) => setLogline(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="One sentence that sells your film."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Genre</label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="storytime-input rounded-xl px-3 py-2"
                placeholder="Drama, Sci-Fi, Thriller..."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-400">Collaboration</label>
              <button
                type="button"
                onClick={() => setIsCollaboration((v) => !v)}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition",
                  isCollaboration
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                    : "bg-white/[0.03] border-white/10 text-slate-300",
                ].join(" ")}
              >
                <span className="w-2 h-2 rounded-full border border-slate-500 bg-slate-900">
                  <span
                    className={[
                      "block w-full h-full rounded-full transition",
                      isCollaboration ? "bg-emerald-400" : "bg-transparent",
                    ].join(" ")}
                  />
                </span>
                {isCollaboration ? "Collaboration project" : "Solo project (you can still invite later)"}
              </button>
              <p className="text-[11px] text-slate-500">
                Mark this as a collaboration to make it easier to invite creators you follow from the Network to work on the film with you.
              </p>
            </div>
            {isCollaboration && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-slate-400">
                  Add collaborators from your network
                </label>
                {networkCreators.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/12 px-3 py-2 text-[11px] text-slate-500">
                    You don&apos;t have any connected creators yet. Use the Network tab to follow
                    and connect with other creators – once a connection is accepted, you&apos;ll be
                    able to invite them here.
                  </p>
                ) : (
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-white/8 bg-black/12 px-2 py-2">
                    {networkCreators.map((c) => {
                      const active = selectedCollaborators.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCollaborator(c.id)}
                          className={[
                            "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs border transition",
                            active
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                              : "bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/18",
                          ].join(" ")}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[10px]">
                            {c.name?.[0]?.toUpperCase() ?? "C"}
                          </span>
                          <span className="max-w-[120px] truncate">
                            {c.name ?? "Creator"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="border-white/10 text-slate-300"
              onClick={() => {
                setCreating(false);
                setTitle("");
                setLogline("");
                setGenre("");
              }}
            >
              Cancel
            </Button>
            <Button disabled={!title || !type || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating..." : "Create project"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="storytime-empty-state p-8 text-center">
          <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-200 font-medium mb-1">No projects yet</p>
          <p className="text-sm text-slate-400 mb-4">
            Create your first film project to start using the full production pipeline.
          </p>
          <Button onClick={() => setCreating(true)} className="mx-auto flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              defaultOpen={project.id === openProjectId}
              linkedCatalogue={pickLinkedCatalogue(project.id, contents)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

