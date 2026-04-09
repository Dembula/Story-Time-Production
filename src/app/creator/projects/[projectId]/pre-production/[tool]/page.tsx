 "use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronDown, ChevronRight, Clapperboard, FileText } from "lucide-react";
import { ProjectStageControls } from "../../project-stage-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModocFieldPopover } from "@/components/modoc";
import { useModoc, useModocOptional } from "@/components/modoc/use-modoc";

interface PreProductionToolPageProps {
  params: Promise<{ projectId?: string; tool: string }>;
}

const LABELS: Record<string, string> = {
  "idea-development": "Idea Development",
  "script-writing": "Script Writing",
  "script-review": "Script Review",
  "script-breakdown": "Script Breakdown",
  "budget-builder": "Budget Builder",
  "production-scheduling": "Production Scheduling",
  "casting-portal": "Casting Portal",
  "crew-marketplace": "Crew Marketplace",
  "location-marketplace": "Location Marketplace",
  "visual-planning": "Visual Planning",
  "legal-contracts": "Legal & Contracts",
  "funding-hub": "Funding Hub",
  "pitch-deck-builder": "Pitch Deck Builder",
  "table-reads": "Table Reads",
  "production-workspace": "Production Workspace",
  "equipment-planning": "Equipment Planning",
  "risk-insurance": "Risk & Insurance",
  "production-readiness": "Production Readiness Dashboard",
};

function UnlinkedBanner() {
  return (
    <div className="storytime-plan-card border-amber-400/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100/95">
      No project linked. Use the dropdown above to link a project and save your work, or create one from the dashboard.
    </div>
  );
}

export default function PreProductionToolPage({ params }: PreProductionToolPageProps) {
  const [resolved, setResolved] = useState<{ projectId?: string; tool: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.resolve(params).then((p) => {
      if (alive) setResolved(p);
    });
    return () => {
      alive = false;
    };
  }, [params]);

  const projectId = resolved?.projectId;
  const tool = resolved?.tool ?? "";
  const title = LABELS[tool] ?? "Pre-Production Workspace";
  const hasProject = !!projectId;

  if (tool === "idea-development") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <IdeaDevelopmentWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "script-writing") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ScriptWritingWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "script-review") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ScriptReviewWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "script-breakdown") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ScriptBreakdownWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "budget-builder") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <BudgetBuilderWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "production-scheduling") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ProductionSchedulingWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "casting-portal") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <CastingPortalWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "crew-marketplace") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <CrewMarketplaceWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "location-marketplace") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <LocationMarketplaceWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "legal-contracts") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <LegalContractsWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "funding-hub") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <FundingHubWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "pitch-deck-builder") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <PitchDeckWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "table-reads") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <TableReadsWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "production-workspace") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ProductionWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "equipment-planning") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <EquipmentPlanningWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "risk-insurance") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <RiskInsuranceWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "production-readiness") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ProductionReadinessWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "visual-planning") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <VisualPlanningWorkspace projectId={projectId} title={title} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">
          Dedicated workspace for this part of Pre-Production. As you build out this project, use
          this section to keep all planning for this topic in one place.
        </p>
      </div>
    </div>
  );
}

// --- Idea Development ---

interface IdeaDevelopmentWorkspaceProps {
  projectId?: string;
  title: string;
}

function IdeaDevelopmentWorkspace({ projectId, title }: IdeaDevelopmentWorkspaceProps) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-ideas", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/ideas`).then((r) => r.json()),
    enabled: hasProject,
  });

  const ideas = (data?.ideas ?? []) as {
    id: string;
    title: string;
    logline: string | null;
    notes: string | null;
    genres: string | null;
    convertedToProject: boolean;
    updatedAt: string;
  }[];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => ideas.find((i) => i.id === selectedId) ?? ideas[0],
    [ideas, selectedId]
  );

  useEffect(() => {
    if (!selectedId && ideas.length > 0) {
      setSelectedId(ideas[0].id);
    }
  }, [ideas, selectedId]);

  type IdeaDraft = {
    id?: string;
    title: string;
    logline: string;
    notes: string;
    genres: string;
  };
  const [draft, setDraft] = useState<IdeaDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<IdeaDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) {
      const snap: IdeaDraft = {
        id: selected.id,
        title: selected.title,
        logline: selected.logline ?? "",
        notes: selected.notes ?? "",
        genres: selected.genres ?? "",
      };
      setDraft(snap);
      setSavedSnapshot(snap);
    } else {
      setDraft(null);
      setSavedSnapshot(null);
    }
  }, [selected?.id]);

  const ideaDirty =
    !!draft &&
    !!savedSnapshot &&
    JSON.stringify({
      title: draft.title,
      logline: draft.logline,
      notes: draft.notes,
      genres: draft.genres,
    }) !==
      JSON.stringify({
        title: savedSnapshot.title,
        logline: savedSnapshot.logline,
        notes: savedSnapshot.notes,
        genres: savedSnapshot.genres,
      });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New idea" }),
      });
      if (!res.ok) throw new Error("Failed to create idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-ideas", projectId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title?: string;
      logline?: string;
      notes?: string;
      genres?: string;
      convert?: boolean;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/ideas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payload.id,
          title: payload.title,
          logline: payload.logline,
          notes: payload.notes,
          genres: payload.genres,
          convertedToProject: payload.convert ?? false,
          syncToProjectMeta: payload.convert ?? false,
        }),
      });
      if (!res.ok) throw new Error("Failed to save idea");
      return res.json();
    },
    onMutate: () => setSaving(true),
    onSuccess: (_d, vars) => {
      setSavedSnapshot({
        id: vars.id,
        title: vars.title ?? "",
        logline: vars.logline ?? "",
        notes: vars.notes ?? "",
        genres: vars.genres ?? "",
      });
    },
    onSettled: () => {
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ["project-ideas", projectId] });
    },
  });

  const modoc = useModocOptional();
  const [modocFieldOpen, setModocFieldOpen] = useState<"logline" | "idea_notes" | null>(null);

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Vault for film ideas, loglines, notes, moodboards, and genres. Convert the strongest
            ideas into the project’s core metadata.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={() => hasProject && createMutation.mutate()}
            disabled={!hasProject}
            title={!hasProject ? "Link a project above to create ideas" : undefined}
          >
            New idea
          </Button>
        </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          <p className="text-xs text-slate-400">Idea vault</p>
          <div className="creator-glass-panel max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-10 bg-slate-800/60" />
                <Skeleton className="h-10 bg-slate-800/60" />
              </div>
            ) : ideas.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                {!hasProject
                  ? "Link a project above to create and save ideas."
                  : "No ideas yet. Start by creating a new concept for this film."}
              </div>
            ) : (
              <ul className="p-2 space-y-1 text-xs">
                {ideas.map((idea) => (
                  <li key={idea.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(idea.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition ${
                        idea.id === selected?.id
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px]">{idea.title}</span>
                        {idea.convertedToProject && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
                            In project
                          </span>
                        )}
                      </div>
                      {idea.genres && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {idea.genres}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          {draft ? (
            <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>Idea details</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-normal text-slate-400">
                      {saving ? "Saving…" : ideaDirty ? "Unsaved changes" : "Saved"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-[11px] h-8"
                      disabled={!ideaDirty || saving || !draft?.id}
                      onClick={() => {
                        if (savedSnapshot) setDraft({ ...savedSnapshot });
                      }}
                    >
                      Discard
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] h-8"
                      disabled={!ideaDirty || saving || !draft?.id}
                      onClick={() => {
                        if (!draft?.id) return;
                        saveMutation.mutate({
                          id: draft.id,
                          title: draft.title,
                          logline: draft.logline,
                          notes: draft.notes,
                          genres: draft.genres,
                        });
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Idea title</label>
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. The Last Light"
                    className="bg-slate-900 border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-slate-400">Logline</label>
                    {modoc && (
                      <button
                        type="button"
                        onClick={() => setModocFieldOpen("logline")}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Get MODOC insights
                      </button>
                    )}
                  </div>
                  <textarea
                    value={draft.logline}
                    onChange={(e) => setDraft({ ...draft, logline: e.target.value })}
                    rows={2}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 resize-none"
                    placeholder="One sentence that sells this idea."
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs text-slate-400">Idea notes</label>
                    {modoc && (
                      <button
                        type="button"
                        onClick={() => setModocFieldOpen("idea_notes")}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Get MODOC pointers
                      </button>
                    )}
                  </div>
                  <textarea
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    rows={5}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                    placeholder="Tone, themes, world, characters, visual ideas..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Genres / tags</label>
                  <Input
                    value={draft.genres}
                    onChange={(e) => setDraft({ ...draft, genres: e.target.value })}
                    placeholder="Drama, Sci-Fi, Thriller..."
                    className="bg-slate-900 border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Converting will sync the title, logline, and genre into the main project
                    metadata.
                  </p>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                    onClick={() => {
                      if (!draft.id) return;
                      saveMutation.mutate({
                        id: draft.id!,
                        title: draft.title,
                        logline: draft.logline,
                        notes: draft.notes,
                        genres: draft.genres,
                        convert: true,
                      });
                    }}
                  >
                    Convert to project details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
              Select an idea on the left or create a new one.
            </div>
          )}
        </div>
      </div>

      {modoc && draft && modocFieldOpen === "logline" && (
        <ModocFieldPopover
          open={true}
          onClose={() => setModocFieldOpen(null)}
          task="logline"
          context={{ title: draft.title, logline: draft.logline }}
          onIncorporate={(text) => {
            setDraft((d) => (d ? { ...d, logline: text } : null));
            setModocFieldOpen(null);
          }}
          sectionLabel="logline"
        />
      )}
      {modoc && draft && modocFieldOpen === "idea_notes" && (
        <ModocFieldPopover
          open={true}
          onClose={() => setModocFieldOpen(null)}
          task="idea_notes"
          context={{
            title: draft.title,
            logline: draft.logline,
            notesExcerpt: draft.notes.slice(0, 600),
          }}
          onIncorporate={(text) => {
            setDraft((d) => (d ? { ...d, notes: d.notes ? `${d.notes}\n\n${text}` : text } : null));
            setModocFieldOpen(null);
          }}
          sectionLabel="idea notes"
        />
      )}
    </div>
  );
}

// --- Script Writing (simplified but fully wired) ---

interface ScriptWritingWorkspaceProps {
  projectId?: string;
  title: string;
}

function ScriptWritingWorkspace({ projectId, title }: ScriptWritingWorkspaceProps) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;

  const listEndpoint = hasProject
    ? `/api/creator/scripts?projectId=${projectId}`
    : "/api/creator/scripts";

  const { data, isLoading } = useQuery({
    queryKey: ["creator-scripts", projectId ?? null],
    queryFn: () => fetch(listEndpoint).then((r) => r.json()),
  });

  const scripts =
    ((data?.scripts as { id: string; title: string; type: string; content: string }[]) ?? []) || [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = scripts.find((s) => s.id === selectedId) ?? scripts[0];

  const [draft, setDraft] = useState<{
    id?: string;
    title: string;
    type: string;
    content: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!selectedId && scripts.length > 0) {
      setSelectedId(scripts[0].id);
    }
  }, [scripts, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraft({
        id: selected.id,
        title: selected.title,
        type: selected.type || "FEATURE",
        content: selected.content || "",
      });
      setDirty(false);
    } else {
      setDraft(null);
      setDirty(false);
    }
  }, [selected?.id]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: hasProject ? "New project script" : "New script",
          projectId: hasProject ? projectId : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create script");
      return res.json();
    },
    onSuccess: (result: any) => {
      const created = result?.script as
        | { id: string; title: string; type: string; content: string }
        | undefined;
      if (created?.id) {
        setSelectedId(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ["creator-scripts", projectId ?? null] });
    },
    onError: () => {
      // eslint-disable-next-line no-alert
      alert("We couldn't create a new script. Please try again.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string; title: string; type: string; content: string }) => {
      const res = await fetch("/api/creator/scripts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payload.id,
          title: payload.title,
          type: payload.type,
          content: payload.content,
          projectId: hasProject ? projectId : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save script");
      return res.json();
    },
    onSuccess: () => {
      setDirty(false);
    },
    onSettled: () => {
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ["creator-scripts", projectId ?? null] });
    },
  });

  const publishToProjectMutation = useMutation({
    mutationFn: async (creatorScriptId: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/script/publish-from-creator-script`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorScriptId }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Publish failed");
      return data as { scenesSynced?: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-schedule", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-script", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-scenes", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-breakdown", projectId] });
    },
  });

  const wordCount = draft?.content
    ? draft.content
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean).length
    : 0;
  const sceneCount = draft?.content
    ? draft.content.split(/\n/).filter((line) => line.trim().match(/^(INT\.|EXT\.)/)).length
    : 0;

  const approxPages = draft?.content ? Math.max(1, Math.round(draft.content.length / 1800)) : 0;

  const modoc = useModocOptional();
  const [modocScriptOpen, setModocScriptOpen] = useState(false);

  const { data: ideasData } = useQuery({
    enabled: !!hasProject && !!projectId,
    queryKey: ["project-ideas", projectId],
    queryFn: () =>
      fetch(`/api/creator/projects/${projectId}/ideas`).then((r) => r.json()),
  });
  const projectIdeas = (ideasData?.ideas ?? []) as Array<{
    id: string;
    title: string;
    logline: string | null;
    notes: string | null;
  }>;
  const primaryIdea = projectIdeas[0];

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Full screenplay workspace with manual saves, script library, and basic scene stats.
            {hasProject
              ? " The production schedule, breakdown, and call sheets use the separate project screenplay—publish your library script to sync it and refresh scene rows."
              : " You can also write standalone scripts without linking a project."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] text-slate-400">
              {saving ? "Saving..." : dirty ? "Unsaved changes" : "Saved"}
            </span>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>{wordCount} words</span>
              <span>• {sceneCount} scenes</span>
              <span>• ~{approxPages} pages</span>
            </div>
          </div>
        </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Script library</p>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-[11px] text-slate-100"
              onClick={() => createMutation.mutate()}
            >
              New script
            </Button>
          </div>
          <div className="creator-glass-panel max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-10 bg-slate-800/60" />
                <Skeleton className="h-10 bg-slate-800/60" />
              </div>
            ) : scripts.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                No scripts yet. Create a new screenplay to start writing.
              </div>
            ) : (
              <ul className="p-2 space-y-1 text-xs">
                {scripts.map((script) => (
                  <li key={script.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(script.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition ${
                        script.id === selected?.id
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px]">{script.title}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          {draft ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-[2fr_minmax(0,1fr)] gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Script title</label>
                  <Input
                    value={draft.title}
                    onChange={(e) => {
                      setDraft({ ...draft, title: e.target.value });
                      setDirty(true);
                    }}
                    className="bg-slate-900 border-slate-700 text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Script type</label>
                  <select
                    value={draft.type}
                    onChange={(e) => {
                      setDraft({ ...draft, type: e.target.value });
                      setDirty(true);
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                  >
                    <option value="FEATURE">Feature film</option>
                    <option value="SHORT">Short film</option>
                    <option value="EPISODE">Series episode</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">Screenplay</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {modoc && (
                      <button
                        type="button"
                        onClick={() => setModocScriptOpen(true)}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        Get MODOC suggestions
                      </button>
                    )}
                    <span className="text-[10px] text-slate-500">|</span>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
                    <button
                      type="button"
                      className="px-2 py-1 rounded-full border border-slate-700 hover:border-orange-500 hover:text-orange-300 transition"
                      onClick={() => {
                        const extra = "\nINT. LOCATION - DAY\n\n";
                        setDraft({ ...draft, content: (draft.content || "") + extra });
                        setDirty(true);
                      }}
                    >
                      + Slugline
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-full border border-slate-700 hover:border-orange-500 hover:text-orange-300 transition"
                      onClick={() => {
                        const extra = "\nCHARACTER NAME\n";
                        setDraft({ ...draft, content: (draft.content || "") + extra });
                        setDirty(true);
                      }}
                    >
                      + Character
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-full border border-slate-700 hover:border-orange-500 hover:text-orange-300 transition"
                      onClick={() => {
                        const extra = "\n    (beat)\n";
                        setDraft({ ...draft, content: (draft.content || "") + extra });
                        setDirty(true);
                      }}
                    >
                      + Parenthetical
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded-full border border-slate-700 hover:border-orange-500 hover:text-orange-300 transition"
                      onClick={() => {
                        const extra = "\nCUT TO:\n";
                        setDraft({ ...draft, content: (draft.content || "") + extra });
                        setDirty(true);
                      }}
                    >
                      + Transition
                    </button>
                    </div>
                  </div>
                </div>
                <textarea
                  value={draft.content}
                  onChange={(e) => {
                    setDraft({ ...draft, content: e.target.value });
                    setDirty(true);
                  }}
                  rows={24}
                  className="w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 text-[13px] font-mono text-slate-100 outline-none focus:border-orange-500 leading-relaxed"
                  placeholder="INT. LOCATION - DAY&#10;&#10;Action lines, CHARACTER names, and dialogue..."
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-xs text-slate-100"
                  disabled={!dirty || !selected}
                  onClick={() => {
                    if (!selected) return;
                    setDraft({
                      id: selected.id,
                      title: selected.title,
                      type: selected.type || "FEATURE",
                      content: selected.content || "",
                    });
                    setDirty(false);
                  }}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-xs text-slate-100"
                  disabled={!draft.id || saving || !dirty}
                  onClick={() => {
                    if (!draft.id) return;
                    setSaving(true);
                    saveMutation.mutate({
                      id: draft.id!,
                      title: draft.title,
                      type: draft.type,
                      content: draft.content,
                    });
                  }}
                >
                  Save
                </Button>
                {hasProject && selected?.id && (
                  <Button
                    size="sm"
                    className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs"
                    disabled={publishToProjectMutation.isPending || dirty}
                    title={
                      dirty
                        ? "Save your script first so the project screenplay matches what you publish."
                        : "Copy this script into the project screenplay and parse scene headings into project scenes."
                    }
                    onClick={() => publishToProjectMutation.mutate(selected.id)}
                  >
                    {publishToProjectMutation.isPending
                      ? "Publishing…"
                      : "Publish to project scenes"}
                  </Button>
                )}
              </div>
              {hasProject && dirty && (
                <p className="text-[11px] text-amber-400/90 text-right">
                  Save before publishing so the project schedule gets the latest text.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
              Create a new script on the left to start writing.
            </div>
          )}
        </div>
      </div>

      {modoc && draft && modocScriptOpen && (
        <ModocFieldPopover
          open={true}
          onClose={() => setModocScriptOpen(false)}
          task="script"
          context={{
            title: draft.title || primaryIdea?.title,
            logline: primaryIdea?.logline ?? undefined,
            notesExcerpt: primaryIdea?.notes ? primaryIdea.notes.slice(0, 500) : undefined,
            scriptExcerpt: (draft.content || "").slice(0, 2500),
          }}
          onIncorporate={(text) => {
            setDraft((d) => (d ? { ...d, content: d.content ? `${d.content}\n\n${text}` : text } : null));
            setDirty(true);
            setModocScriptOpen(false);
          }}
          sectionLabel="script"
          projectId={projectId}
        />
      )}
    </div>
  );
}

// --- Script Review (paid option wired) ---

function getModocMessageContent(message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((p) => (p.type === "text" ? (p as { text?: string }).text ?? "" : ""))
      .join("");
  }
  return "";
}

interface ModocScriptReviewModalProps {
  scriptTitle: string;
  scriptContent: string;
  onComplete: (reviewText: string) => void;
  onClose: () => void;
}

function ModocScriptReviewModal({ scriptTitle, scriptContent, onComplete, onClose }: ModocScriptReviewModalProps) {
  const { append, messages, status, setRequestContext } = useModoc();
  const appendedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setRequestContext({
      scope: "idea-development",
      clientContext: `Task: script_review. Script title: ${scriptTitle}. Full script review requested.`,
      pageContext: { task: "script_review" },
    });
  }, [scriptTitle, setRequestContext]);

  useEffect(() => {
    if (appendedRef.current) return;
    appendedRef.current = true;
    const excerpt = scriptContent.slice(0, 14000);
    const prompt = `Please review this screenplay and give structured feedback (story, structure, characters, dialogue, summary).\n\nTitle: ${scriptTitle}\n\nScript content:\n\n${excerpt}`;
    append({ role: "user", content: prompt });
  }, [scriptTitle, scriptContent, append]);

  useEffect(() => {
    if (completedRef.current || status !== "ready" || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const text = getModocMessageContent(last);
    if (!text.trim()) return;
    completedRef.current = true;
    onComplete(text);
    onClose();
  }, [status, messages, onComplete, onClose]);

  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  const displayContent = lastAssistant ? getModocMessageContent(lastAssistant) : "";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            MODOC script review — {scriptTitle}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg">×</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-sm text-slate-200 whitespace-pre-wrap">
          {status === "streaming" || status === "submitted" ? (
            displayContent ? (
              displayContent
            ) : (
              <span className="text-slate-400">MODOC is reviewing your script…</span>
            )
          ) : (
            displayContent || "Waiting for MODOC…"
          )}
        </div>
      </div>
    </>
  );
}

const MODOC_REPORT_TASKS = [
  "script_breakdown",
  "budget",
  "schedule",
  "location_marketplace",
  "equipment_planning",
  "casting_portal",
  "crew_marketplace",
  "visual_planning",
  "legal_contracts",
  "funding_hub",
  "pitch_deck",
  "table_reads",
  "production_workspace",
  "risk_insurance",
  "production_readiness",
] as const;

interface ModocReportModalProps {
  task: (typeof MODOC_REPORT_TASKS)[number];
  reportTitle: string;
  prompt: string;
  onClose: () => void;
  /** When provided (e.g. for script_breakdown), show "Add to breakdown" and call with response text */
  onApplyToBreakdown?: (responseText: string) => void;
  /** For marketplace tasks, pass projectId so the API can inject project + platform context */
  projectId?: string | null;
}

function ModocReportModal({ task, reportTitle, prompt, onClose, onApplyToBreakdown, projectId }: ModocReportModalProps) {
  const { append, messages, status, setRequestContext } = useModoc();
  const appendedRef = useRef(false);

  const scope =
    task === "location_marketplace"
      ? "location-marketplace"
      : task === "equipment_planning"
        ? "equipment-planning"
        : task === "casting_portal"
          ? "casting-portal"
          : task === "crew_marketplace"
            ? "crew-marketplace"
            : task === "visual_planning"
              ? "visual-planning"
              : task === "legal_contracts"
                ? "legal-contracts"
                : task === "funding_hub"
                  ? "funding-hub"
                  : task === "pitch_deck"
                    ? "pitch-deck-builder"
                    : task === "table_reads"
                      ? "table-reads"
                      : task === "production_workspace"
                        ? "production-workspace"
                        : task === "risk_insurance"
                          ? "risk-insurance"
                          : task === "production_readiness"
                            ? "production-readiness"
                            : "idea-development";

  useEffect(() => {
    setRequestContext({
      scope,
      clientContext: `Task: ${task}. ${prompt.slice(0, 200)}...`,
      pageContext: { task, ...(projectId && { projectId }) },
    });
  }, [scope, task, prompt, projectId, setRequestContext]);

  useEffect(() => {
    if (appendedRef.current) return;
    appendedRef.current = true;
    append({ role: "user", content: prompt });
  }, [prompt, append]);

  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  const displayContent = lastAssistant ? getModocMessageContent(lastAssistant) : "";
  const canApply = task === "script_breakdown" && !!onApplyToBreakdown && !!displayContent.trim() && status !== "streaming" && status !== "submitted";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            {reportTitle}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg text-xl leading-none">×</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-sm text-slate-200 whitespace-pre-wrap">
          {status === "streaming" || status === "submitted" ? (
            displayContent ? displayContent : <span className="text-slate-400">MODOC is working…</span>
          ) : (
            displayContent || "Waiting for MODOC…"
          )}
        </div>
        {canApply && (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              size="sm"
              className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs"
              onClick={() => onApplyToBreakdown(displayContent)}
            >
              Add to breakdown
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/** Parse MODOC breakdown response for lines like "CHARACTER: a | b | c" and return items to merge into draft */
function parseModocBreakdownResponse(text: string): Partial<BreakdownPayload> {
  const result: Partial<BreakdownPayload> = {};
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const charMatch = t.match(/^CHARACTER:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/i);
    if (charMatch) {
      (result.characters = result.characters ?? []).push({ name: charMatch[1].trim(), importance: charMatch[2].trim(), description: charMatch[3].trim() });
      continue;
    }
    const propMatch = t.match(/^PROP:\s*(.+?)\s*\|\s*(.+)$/i);
    if (propMatch) {
      (result.props = result.props ?? []).push({ name: propMatch[1].trim(), description: propMatch[2].trim(), special: false });
      continue;
    }
    const locMatch = t.match(/^LOCATION:\s*(.+?)\s*\|\s*(.+)$/i);
    if (locMatch) {
      (result.locations = result.locations ?? []).push({ name: locMatch[1].trim(), description: locMatch[2].trim() });
      continue;
    }
    const wardMatch = t.match(/^WARDROBE:\s*(.+?)\s*\|\s*(.+)$/i);
    if (wardMatch) {
      (result.wardrobe = result.wardrobe ?? []).push({ description: wardMatch[1].trim(), character: wardMatch[2].trim() || null });
      continue;
    }
    const extMatch = t.match(/^EXTRAS:\s*(.+?)(?:\s*\|\s*(\d+))?$/i);
    if (extMatch) {
      (result.extras = result.extras ?? []).push({ description: extMatch[1].trim(), quantity: extMatch[2] ? parseInt(extMatch[2], 10) || 1 : 1 });
      continue;
    }
    const vehMatch = t.match(/^VEHICLE:\s*(.+?)\s*\|\s*(yes|no|true|false)$/i);
    if (vehMatch) {
      (result.vehicles = result.vehicles ?? []).push({ description: vehMatch[1].trim(), stuntRelated: /yes|true/i.test(vehMatch[2]) });
      continue;
    }
    const stuntMatch = t.match(/^STUNT:\s*(.+?)\s*\|\s*(.+)$/i);
    if (stuntMatch) {
      (result.stunts = result.stunts ?? []).push({ description: stuntMatch[1].trim(), safetyNotes: stuntMatch[2].trim() || null });
      continue;
    }
    const sfxMatch = t.match(/^SFX:\s*(.+?)\s*\|\s*(yes|no|true|false)$/i);
    if (sfxMatch) {
      (result.sfx = result.sfx ?? []).push({ description: sfxMatch[1].trim(), practical: /yes|true/i.test(sfxMatch[2]) });
      continue;
    }
  }
  return result;
}

interface ScriptReviewWorkspaceProps {
  projectId?: string;
  title: string;
}

function ScriptReviewWorkspace({ projectId, title }: ScriptReviewWorkspaceProps) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [requesting, setRequesting] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [modocReviewScriptId, setModocReviewScriptId] = useState<string | null>(null);
  const [modocReviews, setModocReviews] = useState<Array<{ id: string; scriptId: string; scriptTitle: string; reviewText: string; createdAt: string }>>([]);

  const { data: scriptsData } = useQuery({
    enabled: !!hasProject && !!projectId,
    queryKey: ["creator-scripts", projectId],
    queryFn: () => fetch(`/api/creator/scripts?projectId=${projectId}`).then((r) => r.json()),
  });
  const projectScripts = (scriptsData?.scripts ?? []) as Array<{ id: string; title: string; content?: string; type?: string }>;

  const modoc = useModocOptional();

  const notesEndpoint = hasProject
    ? `/api/creator/projects/${projectId}/script-review`
    : "/api/creator/script-review/notes";

  const { data, isLoading } = useQuery({
    queryKey: ["script-review", projectId ?? null],
    queryFn: () => fetch(notesEndpoint).then((r) => r.json()),
  });

  const requests =
    ((data?.requests as {
      id: string;
      status: string;
      feeAmount: number;
      submittedAt: string;
      reviewedAt: string | null;
      feedbackUrl: string | null;
      feedbackNotes: string | null;
    }[]) ?? []) || [];

  useEffect(() => {
    const initialBody = (data?.notes?.body as string) ?? "";
    setNotes(initialBody);
    setNotesDirty(false);
  }, [data?.notes?.body]);

  useEffect(() => {
    if (projectScripts.length > 0 && !selectedScriptId) {
      setSelectedScriptId(projectScripts[0].id);
    }
  }, [projectScripts, selectedScriptId]);

  const hasOpenRequest = requests.some(
    (r) => r.status === "PENDING_ADMIN_REVIEW" || r.status === "IN_REVIEW",
  );

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/script-review`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to request review");
      }
      return res.json();
    },
    onMutate: () => setRequesting(true),
    onSettled: () => {
      setRequesting(false);
      queryClient.invalidateQueries({ queryKey: ["script-review", projectId ?? null] });
    },
  });

  const notesMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(notesEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notesBody: body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save notes");
      }
      return res.json();
    },
    onMutate: () => setNotesSaving(true),
    onSuccess: () => {
      setNotesDirty(false);
    },
    onSettled: () => {
      setNotesSaving(false);
      queryClient.invalidateQueries({ queryKey: ["script-review", projectId ?? null] });
    },
  });

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
          Pre-production workspace
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Review your script internally and optionally request a Story Time Executive Script Review for professional feedback.
        </p>
      </header>

      {hasProject && projectScripts.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
          <label className="text-xs font-medium text-slate-400 block mb-2">Script you&apos;re reviewing</label>
          <select
            value={selectedScriptId || projectScripts[0]?.id || ""}
            onChange={(e) => setSelectedScriptId(e.target.value)}
            className="w-full max-w-md rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
          >
            <option value="">Select a script</option>
            {projectScripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between gap-3">
                <span>Internal notes</span>
                <span className="text-[11px] font-normal text-slate-400">
                  {notesSaving ? "Saving..." : notesDirty ? "Unsaved changes" : "Saved"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-slate-400">
                Capture internal comments and feedback here. This can be expanded into per-scene
                notes later.
              </p>
              <textarea
                rows={10}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                placeholder="Strengths, issues, questions for the next draft..."
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesDirty(true);
                }}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-xs text-slate-100"
                  disabled={notesSaving || !notesDirty}
                  onClick={() => notesMutation.mutate(notes)}
                >
                  Save notes
                </Button>
              </div>
            </CardContent>
          </Card>
          {hasProject && (
            <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Executive review history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-slate-300">
                {isLoading ? (
                  <p className="text-slate-500">Loading history…</p>
                ) : requests.length === 0 ? (
                  <p className="text-slate-500">
                    No executive script reviews have been requested for this project yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {requests.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium text-slate-100">
                            R{r.feeAmount.toFixed(2)} · {r.status.replace(/_/g, " ")}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Requested{" "}
                            {new Date(r.submittedAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            {r.reviewedAt
                              ? ` · Reviewed ${new Date(r.reviewedAt).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        {r.feedbackUrl && (
                          <a
                            href={r.feedbackUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-orange-300 hover:text-orange-200 underline"
                          >
                            Open feedback
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          {hasProject && modocReviews.length > 0 && (
            <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">MODOC review history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-300">
                <ul className="space-y-3">
                  {modocReviews.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-cyan-500/20 bg-slate-900/60 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-medium text-cyan-200/90">MODOC review · {r.scriptTitle}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      <div className="text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                        {r.reviewText}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Story Time Executive Script Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300">
              <p>
                Submit your latest draft for an Executive Script Review by Story Time for detailed
                feedback on story, structure, character, and market positioning.
              </p>
              <p className="text-orange-300 font-medium">Cost: R599.99 (once-off per request)</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Script is submitted to the Story Time admin review dashboard.</li>
                <li>Admins attach feedback directly to this project.</li>
                <li>You’re notified once feedback is ready.</li>
              </ul>
              {modoc && projectScripts.length > 0 && (
                <div className="pt-3 border-t border-slate-700/60 space-y-2">
                  <p className="font-medium text-slate-200">MODOC review</p>
                  <p className="text-[11px] text-slate-400">Get an AI review of a script (free). Pick the script and run MODOC.</p>
                  <select
                    value={selectedScriptId || projectScripts[0]?.id || ""}
                    onChange={(e) => setSelectedScriptId(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    {projectScripts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
                    onClick={() => {
                      const script = projectScripts.find((s) => s.id === (selectedScriptId || projectScripts[0]?.id));
                      if (script) setModocReviewScriptId(script.id);
                    }}
                  >
                    <Bot className="w-3.5 h-3.5 mr-2 inline" />
                    Get MODOC review
                  </Button>
                </div>
              )}
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-2"
                disabled={requesting || !hasProject || hasOpenRequest}
                onClick={() => hasProject && requestMutation.mutate()}
                title={
                  !hasProject
                    ? "Link a project above to request review"
                    : hasOpenRequest
                    ? "You already have a pending review"
                    : undefined
                }
              >
                {requesting ? "Processing..." : "Request Executive Script Review"}
              </Button>
              {requestMutation.error && (
                <p className="text-[11px] text-red-400">
                  {(requestMutation.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {modoc && modocReviewScriptId && (() => {
        const script = projectScripts.find((s) => s.id === modocReviewScriptId);
        if (!script) return null;
        return (
          <ModocScriptReviewModal
            scriptTitle={script.title}
            scriptContent={script.content ?? ""}
            onComplete={(reviewText) => {
              setModocReviews((prev) => [
                ...prev,
                {
                  id: `modoc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                  scriptId: script.id,
                  scriptTitle: script.title,
                  reviewText,
                  createdAt: new Date().toISOString(),
                },
              ]);
            }}
            onClose={() => setModocReviewScriptId(null)}
          />
        );
      })()}
    </div>
  );
}

// --- Script Breakdown (multi-category) ---

interface ScriptBreakdownWorkspaceProps {
  projectId?: string;
  title: string;
}

type BreakdownPayload = {
  characters?: {
    id?: string;
    name: string;
    description?: string | null;
    importance?: string | null;
    sceneId?: string | null;
  }[];
  props?: {
    id?: string;
    name: string;
    description?: string | null;
    special?: boolean;
    sceneId?: string | null;
  }[];
  locations?: {
    id?: string;
    name: string;
    description?: string | null;
    sceneId?: string | null;
    locationListingId?: string | null;
  }[];
  wardrobe?: { id?: string; description: string; character?: string | null; sceneId?: string | null }[];
  extras?: { id?: string; description: string; quantity?: number; sceneId?: string | null }[];
  vehicles?: { id?: string; description: string; stuntRelated?: boolean; sceneId?: string | null }[];
  stunts?: { id?: string; description: string; safetyNotes?: string | null; sceneId?: string | null }[];
  sfx?: { id?: string; description: string; practical?: boolean; sceneId?: string | null }[];
};

function ScriptBreakdownWorkspace({ projectId, title }: ScriptBreakdownWorkspaceProps) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/breakdown`).then((r) => r.json()),
    enabled: hasProject,
  });

  const { data: scriptsData } = useQuery({
    enabled: !!hasProject && !!projectId,
    queryKey: ["creator-scripts-breakdown", projectId],
    queryFn: () => fetch(`/api/creator/scripts?projectId=${projectId}`).then((r) => r.json()),
  });
  const { data: scenesListData } = useQuery({
    enabled: hasProject,
    queryKey: ["project-scenes", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/scenes`).then((r) => r.json()),
  });
  const projectScenesForBreakdown = (scenesListData?.scenes ?? []) as {
    id: string;
    number: string;
    heading: string | null;
  }[];
  const projectScripts = (scriptsData?.scripts ?? []) as Array<{ id: string; title: string; content?: string }>;
  const [breakdownScriptId, setBreakdownScriptId] = useState<string>("");
  const [breakdownSceneFilter, setBreakdownSceneFilter] = useState<string>("");
  const selectedScript = breakdownScriptId ? projectScripts.find((s) => s.id === breakdownScriptId) ?? projectScripts[0] : projectScripts[0];

  useEffect(() => {
    if (projectScripts.length > 0 && !breakdownScriptId) {
      setBreakdownScriptId(projectScripts[0].id);
    }
  }, [projectScripts, breakdownScriptId]);

  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);

  const [tab, setTab] = useState<
    "characters" | "props" | "locations" | "wardrobe" | "extras" | "vehicles" | "stunts" | "sfx"
  >("characters");

  const [draft, setDraft] = useState<BreakdownPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<BreakdownPayload | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !draft) {
      const initial: BreakdownPayload = {
        characters: data.characters ?? [],
        props: data.props ?? [],
        locations: data.locations ?? [],
        wardrobe: data.wardrobe ?? [],
        extras: data.extras ?? [],
        vehicles: data.vehicles ?? [],
        stunts: data.stunts ?? [],
        sfx: data.sfx ?? [],
      };
      setDraft(initial);
      setSavedSnapshot(JSON.parse(JSON.stringify(initial)) as BreakdownPayload);
    }
  }, [data, draft]);

  const breakdownDirty =
    !!draft &&
    !!savedSnapshot &&
    JSON.stringify(draft) !== JSON.stringify(savedSnapshot);

  const saveMutation = useMutation({
    mutationFn: async (payload: BreakdownPayload) => {
      const res = await fetch(`/api/creator/projects/${projectId}/breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save breakdown");
      return res.json();
    },
    onMutate: () => setSaving(true),
    onSuccess: (_d, payload) => {
      setSavedSnapshot(JSON.parse(JSON.stringify(payload)) as BreakdownPayload);
    },
    onSettled: () => {
      setSaving(false);
      queryClient.invalidateQueries({ queryKey: ["project-breakdown", projectId] });
    },
  });

  if (!hasProject) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400">Link a project above to create and save script breakdown (characters, props, locations, etc.).</p>
      </div>
    );
  }
  if (isLoading || !draft) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <Skeleton className="h-64 bg-slate-800/60" />
      </div>
    );
  }

  const breakdownRowsRaw = (draft[tab] as any[]) ?? [];
  const breakdownRowsDisplayed = breakdownRowsRaw
    .map((row, idx) => ({ row, idx }))
    .filter(
      ({ row }) =>
        !breakdownSceneFilter || (row as { sceneId?: string | null }).sceneId === breakdownSceneFilter,
    );
  const scenePicker = (idx: number, row: { sceneId?: string | null }) => (
    <div className="md:col-span-4 space-y-0.5">
      <label className="text-[10px] text-slate-500">Scene (optional)</label>
      <select
        value={row.sceneId ?? ""}
        onChange={(e) => updateRow(idx, "sceneId", e.target.value || null)}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white outline-none focus:border-orange-500"
      >
        <option value="">Not tied to a scene</option>
        {projectScenesForBreakdown.map((s) => (
          <option key={s.id} value={s.id}>
            Sc. {s.number}
            {s.heading ? ` — ${s.heading.slice(0, 48)}${s.heading.length > 48 ? "…" : ""}` : ""}
          </option>
        ))}
      </select>
    </div>
  );

  const sceneForNewRow = breakdownSceneFilter || null;
  const addRow = () => {
    const id = undefined;
    if (tab === "characters") {
      setDraft({
        ...draft,
        characters: [
          ...(draft.characters ?? []),
          { id, name: "", description: "", importance: "", sceneId: sceneForNewRow },
        ],
      });
    } else if (tab === "props") {
      setDraft({
        ...draft,
        props: [...(draft.props ?? []), { id, name: "", description: "", special: false, sceneId: sceneForNewRow }],
      });
    } else if (tab === "locations") {
      setDraft({
        ...draft,
        locations: [
          ...(draft.locations ?? []),
          { id, name: "", description: "", sceneId: sceneForNewRow, locationListingId: null },
        ],
      });
    } else if (tab === "wardrobe") {
      setDraft({
        ...draft,
        wardrobe: [...(draft.wardrobe ?? []), { id, description: "", character: "", sceneId: sceneForNewRow }],
      });
    } else if (tab === "extras") {
      setDraft({
        ...draft,
        extras: [...(draft.extras ?? []), { id, description: "", quantity: 1, sceneId: sceneForNewRow }],
      });
    } else if (tab === "vehicles") {
      setDraft({
        ...draft,
        vehicles: [...(draft.vehicles ?? []), { id, description: "", stuntRelated: false, sceneId: sceneForNewRow }],
      });
    } else if (tab === "stunts") {
      setDraft({
        ...draft,
        stunts: [...(draft.stunts ?? []), { id, description: "", safetyNotes: "", sceneId: sceneForNewRow }],
      });
    } else if (tab === "sfx") {
      setDraft({
        ...draft,
        sfx: [...(draft.sfx ?? []), { id, description: "", practical: false, sceneId: sceneForNewRow }],
      });
    }
  };

  const updateRow = (index: number, field: string, value: any) => {
    const copy = { ...draft } as any;
    copy[tab] = [...(copy[tab] ?? [])];
    copy[tab][index] = { ...copy[tab][index], [field]: value };
    setDraft(copy);
  };

  const removeRow = (index: number) => {
    if (!draft) return;
    const copy = { ...draft } as any;
    const arr = [...(copy[tab] ?? [])];
    arr.splice(index, 1);
    copy[tab] = arr;
    setDraft(copy);
  };

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Extract characters, props, locations, wardrobe, extras, vehicles, stunts, and SFX from
            your script. This data powers casting, locations, equipment, and risk tools later.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {modoc && selectedScript && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC breakdown report
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {saving ? "Saving…" : breakdownDirty ? "Unsaved changes" : "Saved"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 text-[11px] h-8"
              disabled={!breakdownDirty || saving}
              onClick={() => {
                if (savedSnapshot) setDraft(JSON.parse(JSON.stringify(savedSnapshot)) as BreakdownPayload);
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] h-8"
              disabled={!breakdownDirty || saving || !draft}
              onClick={() => draft && saveMutation.mutate(draft)}
            >
              Save
            </Button>
          </div>
        </div>
        </div>
      </header>

      {projectScripts.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
          <label className="text-xs font-medium text-slate-400 block mb-2">Script for this breakdown</label>
          <select
            value={breakdownScriptId || projectScripts[0]?.id || ""}
            onChange={(e) => setBreakdownScriptId(e.target.value)}
            className="w-full max-w-md rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
          >
            <option value="">Select a script</option>
            {projectScripts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">MODOC will use the selected script to detect elements and can auto-fill the breakdown when you click &quot;Add to breakdown&quot;.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            "characters",
            "props",
            "locations",
            "wardrobe",
            "extras",
            "vehicles",
            "stunts",
            "sfx",
          ] as typeof tab[]
        ).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full border text-[11px] ${
              tab === key
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {key === "sfx" ? "SFX" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {projectScenesForBreakdown.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
          <span className="text-slate-400">Filter by scene</span>
          <select
            value={breakdownSceneFilter}
            onChange={(e) => setBreakdownSceneFilter(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-white outline-none focus:border-orange-500 min-w-[200px]"
          >
            <option value="">All items</option>
            {projectScenesForBreakdown.map((s) => (
              <option key={s.id} value={s.id}>
                Sc. {s.number}
                {s.heading ? ` — ${s.heading.slice(0, 32)}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="creator-glass-panel p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-slate-400">
            {breakdownRowsDisplayed.length} item{breakdownRowsDisplayed.length === 1 ? "" : "s"}
            {breakdownSceneFilter ? ` (filtered)` : ""}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
            onClick={addRow}
          >
            Add row
          </Button>
        </div>
        <div className="max-h-[380px] overflow-y-auto space-y-2 text-xs">
          {breakdownRowsDisplayed.length === 0 ? (
            <p className="text-slate-500 text-xs">No items yet. Add your first one.</p>
          ) : (
            breakdownRowsDisplayed.map(({ row, idx }) => (
              <div
                key={row.id ?? idx}
                className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2"
              >
                {tab === "characters" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(idx, "name", e.target.value)}
                      placeholder="Character name"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <Input
                      value={row.importance ?? ""}
                      onChange={(e) => updateRow(idx, "importance", e.target.value)}
                      placeholder="Importance (Lead, Support...)"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <textarea
                      value={row.description ?? ""}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      rows={2}
                      className="md:col-span-2 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-white outline-none"
                      placeholder="Short description"
                    />
                  </>
                )}
                {tab === "props" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(idx, "name", e.target.value)}
                      placeholder="Prop"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <textarea
                      value={row.description ?? ""}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      rows={2}
                      className="md:col-span-2 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-white outline-none"
                      placeholder="Details"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={row.special ?? false}
                        onChange={(e) => updateRow(idx, "special", e.target.checked)}
                        className="w-3 h-3"
                      />
                      Special / hero prop
                    </label>
                  </>
                )}
                {tab === "locations" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(idx, "name", e.target.value)}
                      placeholder="Location name"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <textarea
                      value={row.description ?? ""}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      rows={2}
                      className="md:col-span-3 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-white outline-none"
                      placeholder="Interior/exterior, day/night, notes..."
                    />
                    <div className="md:col-span-4 space-y-0.5">
                      <label className="text-[10px] text-slate-500">Location listing ID (marketplace)</label>
                      <Input
                        value={(row as { locationListingId?: string | null }).locationListingId ?? ""}
                        onChange={(e) =>
                          updateRow(idx, "locationListingId", e.target.value.trim() || null)
                        }
                        placeholder="Paste listing id when booked in Locations"
                        className="bg-slate-950 border-slate-700 text-[11px]"
                      />
                    </div>
                  </>
                )}
                {tab === "wardrobe" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      placeholder="Wardrobe description"
                      className="md:col-span-3 bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <Input
                      value={row.character ?? ""}
                      onChange={(e) => updateRow(idx, "character", e.target.value)}
                      placeholder="Character"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                  </>
                )}
                {tab === "extras" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      placeholder="Extras description"
                      className="md:col-span-3 bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <Input
                      type="number"
                      value={row.quantity ?? 1}
                      onChange={(e) => updateRow(idx, "quantity", Number(e.target.value || 1))}
                      placeholder="Qty"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                  </>
                )}
                {tab === "vehicles" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      placeholder="Vehicle"
                      className="md:col-span-3 bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={row.stuntRelated ?? false}
                        onChange={(e) => updateRow(idx, "stuntRelated", e.target.checked)}
                        className="w-3 h-3"
                      />
                      Stunt related
                    </label>
                  </>
                )}
                {tab === "stunts" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      placeholder="Stunt description"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <textarea
                      value={row.safetyNotes ?? ""}
                      onChange={(e) => updateRow(idx, "safetyNotes", e.target.value)}
                      rows={2}
                      className="md:col-span-3 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-white outline-none"
                      placeholder="Safety notes"
                    />
                  </>
                )}
                {tab === "sfx" && (
                  <>
                    {scenePicker(idx, row)}
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(idx, "description", e.target.value)}
                      placeholder="Effect"
                      className="md:col-span-3 bg-slate-950 border-slate-700 text-[11px]"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={row.practical ?? false}
                        onChange={(e) => updateRow(idx, "practical", e.target.checked)}
                        className="w-3 h-3"
                      />
                      Practical
                    </label>
                  </>
                )}
                <div className="flex justify-end md:col-span-4 pt-0.5">
                  <button
                    type="button"
                    className="text-[10px] font-medium text-red-400 hover:text-red-300"
                    onClick={() => removeRow(idx)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {modoc && modocReportOpen && selectedScript && (
        <ModocReportModal
          task="script_breakdown"
          reportTitle={`MODOC breakdown — ${selectedScript.title}`}
          prompt={`The creator has linked **this script** to the breakdown. Use only this script to generate your report.\n\nScript title: ${selectedScript.title}\n\nGenerate a script breakdown report. Identify and list: scenes (INT/EXT, day/night), characters (with importance if clear), props, locations, wardrobe, extras, vehicles, stunts, SFX. Format as a clear production-ready report with section headers. At the end, list any items the creator can add to their breakdown using exactly one line per item:\nCHARACTER: name | importance | description\nPROP: name | description\nLOCATION: name | description\nWARDROBE: description | character\nEXTRAS: description | quantity\nVEHICLE: description | stunt (yes/no)\nSTUNT: description | safety notes\nSFX: description | practical (yes/no)\n\nCurrent breakdown so far (for context): ${JSON.stringify(draft).slice(0, 1500)}.\n\nScript content:\n\n${(selectedScript.content ?? "").slice(0, 12000)}`}
          onClose={() => setModocReportOpen(false)}
          onApplyToBreakdown={(responseText) => {
            const parsed = parseModocBreakdownResponse(responseText);
            if (
              !parsed.characters?.length &&
              !parsed.props?.length &&
              !parsed.locations?.length &&
              !parsed.wardrobe?.length &&
              !parsed.extras?.length &&
              !parsed.vehicles?.length &&
              !parsed.stunts?.length &&
              !parsed.sfx?.length
            ) return;
            setDraft((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                characters: [...(prev.characters ?? []), ...(parsed.characters ?? [])],
                props: [...(prev.props ?? []), ...(parsed.props ?? [])],
                locations: [...(prev.locations ?? []), ...(parsed.locations ?? [])],
                wardrobe: [...(prev.wardrobe ?? []), ...(parsed.wardrobe ?? [])],
                extras: [...(prev.extras ?? []), ...(parsed.extras ?? [])],
                vehicles: [...(prev.vehicles ?? []), ...(parsed.vehicles ?? [])],
                stunts: [...(prev.stunts ?? []), ...(parsed.stunts ?? [])],
                sfx: [...(prev.sfx ?? []), ...(parsed.sfx ?? [])],
              };
            });
          }}
        />
      )}
    </div>
  );
}

// --- Budget Builder (template-based) ---

interface BudgetBuilderWorkspaceProps {
  projectId?: string;
  title: string;
}

function BudgetBuilderWorkspace({ projectId, title }: BudgetBuilderWorkspaceProps) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/budget`).then((r) => r.json()),
    enabled: hasProject,
  });

  const { data: breakdownData } = useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/breakdown`).then((r) => r.json()),
    enabled: !!hasProject && !!projectId,
  });

  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);

  const budget = data?.budget as
    | {
        id: string;
        template: string;
        totalPlanned: number;
        lines: {
          id: string;
          department: string;
          name: string;
          quantity: number | null;
          unitCost: number | null;
          total: number | null;
          notes: string | null;
        }[];
      }
    | undefined;

  const [templateChoice, setTemplateChoice] = useState<
    "SHORT_FILM" | "INDIE_FILM" | "FEATURE_FILM" | "TV_EPISODE"
  >("SHORT_FILM");

  const [draftLines, setDraftLines] = useState<any[]>([]);
  const [savedLines, setSavedLines] = useState<any[]>([]);

  useEffect(() => {
    if (budget) {
      const lines = budget.lines;
      setDraftLines(lines);
      setSavedLines(JSON.parse(JSON.stringify(lines)));
    }
  }, [budget?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const budgetDirty =
    draftLines.length > 0 || savedLines.length > 0
      ? JSON.stringify(draftLines) !== JSON.stringify(savedLines)
      : false;

  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: templateChoice }),
      });
      if (!res.ok) throw new Error("Failed to create budget");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-budget", projectId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (lines: any[]) => {
      const res = await fetch(`/api/creator/projects/${projectId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!res.ok) throw new Error("Failed to save budget");
      return res.json();
    },
    onSuccess: (_d, lines) => {
      setSavedLines(JSON.parse(JSON.stringify(lines)));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project-budget", projectId] });
    },
  });

  const addLine = () => {
    setDraftLines([
      ...draftLines,
      {
        id: undefined,
        department: "UNASSIGNED",
        name: "",
        quantity: 1,
        unitCost: 0,
        total: 0,
        notes: "",
      },
    ]);
  };

  const removeLine = (index: number) => {
    setDraftLines(draftLines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const copy = [...draftLines];
    const line = { ...copy[index] };
    (line as any)[field] = value;
    const qty = line.quantity ?? 1;
    const unit = line.unitCost ?? 0;
    line.total = qty * unit;
    copy[index] = line;
    setDraftLines(copy);
  };

  const total = useMemo(
    () => draftLines.reduce((sum: number, l: any) => sum + (l.total ?? 0), 0),
    [draftLines]
  );

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Build a department-based budget for this project using templates and editable line
            items. Planned totals feed into the Production Expense Tracker.
          </p>
          {hasProject && projectId && (
            <Link
              href={`/creator/projects/${projectId}/production/expense-tracker`}
              className="inline-block text-xs text-orange-400 hover:text-orange-300 mt-2"
            >
              Open Production Expense Tracker →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modoc && budget && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC budget insights
            </Button>
          )}
          {budget && (
            <>
              <span className="text-[11px] text-slate-400">
                {saveMutation.isPending ? "Saving…" : budgetDirty ? "Unsaved changes" : "Saved"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 text-[11px]"
                disabled={!budgetDirty || saveMutation.isPending}
                onClick={() => setDraftLines(JSON.parse(JSON.stringify(savedLines)))}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white text-[11px]"
                disabled={!budgetDirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate(draftLines)}
              >
                Save
              </Button>
            </>
          )}
          {!budget && (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <select
                value={templateChoice}
                onChange={(e) =>
                  setTemplateChoice(e.target.value as typeof templateChoice)
                }
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
              >
                <option value="SHORT_FILM">Short film</option>
                <option value="INDIE_FILM">Indie film</option>
                <option value="FEATURE_FILM">Feature film</option>
                <option value="TV_EPISODE">TV episode</option>
              </select>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                onClick={() => hasProject && initMutation.mutate()}
                disabled={initMutation.isPending || !hasProject}
              >
                {initMutation.isPending ? "Creating..." : "Create budget"}
              </Button>
            </div>
          )}
        </div>
        </div>
      </header>

      {modoc && budget && modocReportOpen && (
        <ModocReportModal
          task="budget"
          reportTitle="MODOC budget insights"
          prompt={`Analyze this project's script breakdown and current budget, then suggest department-level estimates and cost-saving measures.\n\nBreakdown summary: ${JSON.stringify(breakdownData ?? {}).slice(0, 2000)}\n\nCurrent budget (template: ${budget.template}, total planned: R${total.toFixed(2)}):\n${JSON.stringify(draftLines).slice(0, 2500)}\n\nProvide: suggested departments/line items, rough estimate ranges or ratios, and 2–4 concrete cost-saving tips.`}
          onClose={() => setModocReportOpen(false)}
        />
      )}

      {isLoading ? (
        <Skeleton className="h-64 bg-slate-800/60" />
      ) : !budget ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
          Choose a template and create a budget for this project.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              Template:{" "}
              <span className="font-medium text-slate-100">{budget.template}</span>
            </span>
            <span className="font-semibold text-emerald-400">
              Total planned: R{total.toFixed(2)}
            </span>
          </div>
          <div className="creator-glass-panel max-h-[420px] overflow-y-auto text-xs">
            <table className="w-full border-collapse">
              <thead className="bg-slate-900/80 text-slate-300 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[11px] w-32">Department</th>
                  <th className="px-3 py-2 text-left font-medium text-[11px]">Line item</th>
                  <th className="px-3 py-2 text-right font-medium text-[11px] w-16">Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-[11px] w-24">Unit</th>
                  <th className="px-3 py-2 text-right font-medium text-[11px] w-24">Total</th>
                  <th className="px-3 py-2 text-right font-medium text-[11px] w-16"> </th>
                </tr>
              </thead>
              <tbody>
                {draftLines.map((line: any, idx: number) => (
                  <tr key={line.id ?? idx} className="border-t border-slate-800">
                    <td className="px-3 py-1.5 align-top">
                      <Input
                        value={line.department}
                        onChange={(e) => updateLine(idx, "department", e.target.value)}
                        className="bg-slate-950 border-slate-800 text-[11px]"
                      />
                    </td>
                    <td className="px-3 py-1.5 align-top">
                      <Input
                        value={line.name}
                        onChange={(e) => updateLine(idx, "name", e.target.value)}
                        className="bg-slate-950 border-slate-800 text-[11px]"
                      />
                    </td>
                    <td className="px-3 py-1.5 align-top text-right">
                      <Input
                        type="number"
                        value={line.quantity ?? 1}
                        onChange={(e) =>
                          updateLine(idx, "quantity", Number(e.target.value || 1))
                        }
                        className="bg-slate-950 border-slate-800 text-[11px] text-right"
                      />
                    </td>
                    <td className="px-3 py-1.5 align-top text-right">
                      <Input
                        type="number"
                        value={line.unitCost ?? 0}
                        onChange={(e) =>
                          updateLine(idx, "unitCost", Number(e.target.value || 0))
                        }
                        className="bg-slate-950 border-slate-800 text-[11px] text-right"
                      />
                    </td>
                    <td className="px-3 py-1.5 align-top text-right text-slate-100">
                      R{(line.total ?? 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 align-top text-right">
                      <button
                        type="button"
                        className="text-[10px] font-medium text-red-400 hover:text-red-300"
                        onClick={() => removeLine(idx)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
              onClick={addLine}
            >
              Add line
            </Button>
            <span className="text-[11px]">
              Save to sync with the Production Expense Tracker.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Production Scheduling (shoot days + scenes) ---

interface ProductionSchedulingWorkspaceProps {
  projectId?: string;
  title: string;
}

type ScheduleSceneDetail = {
  id: string;
  number: string;
  heading: string | null;
  summary: string | null;
  pageCount: number | null;
  status: string;
  scriptId: string | null;
  script: { id: string; title: string } | null;
  primaryLocation: { id: string; name: string; description: string | null } | null;
  breakdownCharacters: {
    id: string;
    name: string;
    description: string | null;
    importance: string | null;
  }[];
  breakdownProps: {
    id: string;
    name: string;
    description: string | null;
    special: boolean;
  }[];
  breakdownLocations: { id: string; name: string; description: string | null }[];
  breakdownWardrobes: { id: string; description: string; character: string | null }[];
  breakdownExtras: { id: string; description: string; quantity: number }[];
  breakdownVehicles: { id: string; description: string; stuntRelated: boolean }[];
  breakdownStunts: { id: string; description: string; safetyNotes: string | null }[];
  breakdownSfxs: { id: string; description: string; practical: boolean }[];
};

type ScheduleResponse = {
  script: { id: string; title: string; sceneCount: number } | null;
  shootDays: {
    id: string;
    date: string;
    unit: string | null;
    callTime: string | null;
    wrapTime: string | null;
    status: string;
    locationSummary: string | null;
    scenesBeingShot: string | null;
    dayNotes: string | null;
    scenes: {
      id: string;
      order: number;
      sceneId: string;
      scene: ScheduleSceneDetail | null;
    }[];
  }[];
  scenes: ScheduleSceneDetail[];
};

function useScheduleDayAggregate(day: ScheduleResponse["shootDays"][number] | null) {
  return useMemo(() => {
    if (!day) {
      return {
        characters: [] as { key: string; name: string; detail: string | null; sceneNums: string[] }[],
        locations: [] as { key: string; name: string; detail: string | null; sceneNums: string[] }[],
        props: [] as { key: string; name: string; detail: string | null; special: boolean; sceneNums: string[] }[],
        wardrobes: [] as { key: string; text: string; character: string | null; sceneNums: string[] }[],
        extras: [] as { key: string; text: string; qty: number; sceneNums: string[] }[],
        vehicles: [] as { key: string; text: string; stunt: boolean; sceneNums: string[] }[],
        stunts: [] as { key: string; text: string; safety: string | null; sceneNums: string[] }[],
        sfx: [] as { key: string; text: string; practical: boolean; sceneNums: string[] }[],
      };
    }
    const ordered = day.scenes.slice().sort((a, b) => a.order - b.order);
    const charM = new Map<
      string,
      { name: string; detail: string | null; scenes: Set<string> }
    >();
    const locM = new Map<string, { name: string; detail: string | null; scenes: Set<string> }>();
    const propM = new Map<
      string,
      { name: string; detail: string | null; special: boolean; scenes: Set<string> }
    >();
    const wardrobeM = new Map<string, { text: string; character: string | null; scenes: Set<string> }>();
    const extraM = new Map<string, { text: string; qty: number; scenes: Set<string> }>();
    const vehicleM = new Map<string, { text: string; stunt: boolean; scenes: Set<string> }>();
    const stuntM = new Map<string, { text: string; safety: string | null; scenes: Set<string> }>();
    const sfxM = new Map<string, { text: string; practical: boolean; scenes: Set<string> }>();

    const addScene = (set: Set<string>, num: string) => {
      set.add(num);
    };

    for (const link of ordered) {
      const sc = link.scene;
      if (!sc) continue;
      const sn = sc.number;
      for (const c of sc.breakdownCharacters) {
        const key = c.name.trim().toLowerCase();
        if (!key) continue;
        if (!charM.has(key)) {
          charM.set(key, {
            name: c.name.trim(),
            detail: c.importance || c.description || null,
            scenes: new Set(),
          });
        }
        addScene(charM.get(key)!.scenes, sn);
      }
      if (sc.primaryLocation) {
        const pl = sc.primaryLocation;
        const key = `pri:${pl.id}`;
        if (!locM.has(key)) {
          locM.set(key, { name: pl.name, detail: pl.description, scenes: new Set() });
        }
        addScene(locM.get(key)!.scenes, sn);
      }
      for (const loc of sc.breakdownLocations) {
        const key = `loc:${loc.id}`;
        if (!locM.has(key)) {
          locM.set(key, { name: loc.name, detail: loc.description, scenes: new Set() });
        }
        addScene(locM.get(key)!.scenes, sn);
      }
      for (const p of sc.breakdownProps) {
        const key = p.name.trim().toLowerCase();
        if (!key) continue;
        if (!propM.has(key)) {
          propM.set(key, {
            name: p.name.trim(),
            detail: p.description,
            special: p.special,
            scenes: new Set(),
          });
        }
        addScene(propM.get(key)!.scenes, sn);
      }
      for (const w of sc.breakdownWardrobes) {
        const key = `wd:${w.id}`;
        const prev = wardrobeM.get(key);
        if (!prev) {
          wardrobeM.set(key, {
            text: w.description,
            character: w.character,
            scenes: new Set([sn]),
          });
        } else {
          prev.scenes.add(sn);
        }
      }
      for (const e of sc.breakdownExtras) {
        const key = `ex:${e.id}`;
        const prev = extraM.get(key);
        if (!prev) {
          extraM.set(key, { text: e.description, qty: e.quantity, scenes: new Set([sn]) });
        } else {
          prev.scenes.add(sn);
        }
      }
      for (const v of sc.breakdownVehicles) {
        const key = `vh:${v.id}`;
        const prev = vehicleM.get(key);
        if (!prev) {
          vehicleM.set(key, {
            text: v.description,
            stunt: v.stuntRelated,
            scenes: new Set([sn]),
          });
        } else {
          prev.scenes.add(sn);
        }
      }
      for (const st of sc.breakdownStunts) {
        const key = `st:${st.id}`;
        const prev = stuntM.get(key);
        if (!prev) {
          stuntM.set(key, {
            text: st.description,
            safety: st.safetyNotes,
            scenes: new Set([sn]),
          });
        } else {
          prev.scenes.add(sn);
        }
      }
      for (const fx of sc.breakdownSfxs) {
        const key = `sfx:${fx.id}`;
        const prev = sfxM.get(key);
        if (!prev) {
          sfxM.set(key, {
            text: fx.description,
            practical: fx.practical,
            scenes: new Set([sn]),
          });
        } else {
          prev.scenes.add(sn);
        }
      }
    }

    const sortNums = (s: Set<string>) =>
      [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return {
      characters: [...charM.entries()].map(([key, v]) => ({
        key,
        name: v.name,
        detail: v.detail,
        sceneNums: sortNums(v.scenes),
      })),
      locations: [...locM.entries()].map(([key, v]) => ({
        key,
        name: v.name,
        detail: v.detail,
        sceneNums: sortNums(v.scenes),
      })),
      props: [...propM.entries()].map(([key, v]) => ({
        key,
        name: v.name,
        detail: v.detail,
        special: v.special,
        sceneNums: sortNums(v.scenes),
      })),
      wardrobes: [...wardrobeM.entries()].map(([key, v]) => ({
        key,
        text: v.text,
        character: v.character,
        sceneNums: sortNums(v.scenes),
      })),
      extras: [...extraM.entries()].map(([key, v]) => ({
        key,
        text: v.text,
        qty: v.qty,
        sceneNums: sortNums(v.scenes),
      })),
      vehicles: [...vehicleM.entries()].map(([key, v]) => ({
        key,
        text: v.text,
        stunt: v.stunt,
        sceneNums: sortNums(v.scenes),
      })),
      stunts: [...stuntM.entries()].map(([key, v]) => ({
        key,
        text: v.text,
        safety: v.safety,
        sceneNums: sortNums(v.scenes),
      })),
      sfx: [...sfxM.entries()].map(([key, v]) => ({
        key,
        text: v.text,
        practical: v.practical,
        sceneNums: sortNums(v.scenes),
      })),
    };
  }, [day]);
}

function scheduleFingerprint(days: ScheduleResponse["shootDays"] | null): string {
  if (!days) return "";
  return JSON.stringify(
    days.map((d) => ({
      id: d.id,
      date: d.date,
      unit: d.unit,
      callTime: d.callTime,
      wrapTime: d.wrapTime,
      locationSummary: d.locationSummary,
      status: d.status,
      scenesBeingShot: d.scenesBeingShot,
      dayNotes: d.dayNotes,
      scenes: [...d.scenes]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ order: s.order, sceneId: s.scene?.id ?? s.sceneId })),
    })),
  );
}

function ProductionSchedulingWorkspace({ projectId, title }: ProductionSchedulingWorkspaceProps) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery<ScheduleResponse>({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });

  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [draftDays, setDraftDays] = useState<ScheduleResponse["shootDays"] | null>(null);
  const [savedSchedule, setSavedSchedule] = useState<ScheduleResponse["shootDays"] | null>(null);
  const [expandedSceneRowId, setExpandedSceneRowId] = useState<string | null>(null);

  useEffect(() => {
    if (data && !draftDays) {
      const copy = JSON.parse(JSON.stringify(data.shootDays)) as ScheduleResponse["shootDays"];
      setDraftDays(copy);
      setSavedSchedule(JSON.parse(JSON.stringify(data.shootDays)) as ScheduleResponse["shootDays"]);
      if (!selectedDayId && data.shootDays.length > 0) {
        setSelectedDayId(data.shootDays[0].id);
      }
    }
  }, [data, draftDays, selectedDayId]);

  const selectedDay =
    draftDays?.find((d) => d.id === selectedDayId) ?? draftDays?.[0] ?? null;
  const dayAggregate = useScheduleDayAggregate(selectedDay);

  const scheduleWarnings = useMemo(() => {
    if (!selectedDay) return [] as string[];
    const w: string[] = [];
    if (!selectedDay.locationSummary?.trim()) {
      w.push("This day has no location summary—add one for clearer call sheets.");
    }
    const ordered = selectedDay.scenes.slice().sort((a, b) => a.order - b.order);
    for (const link of ordered) {
      const sc = link.scene;
      if (!sc) {
        w.push("A scene slot references a missing scene—remove it or re-save the schedule.");
        continue;
      }
      if (!sc.primaryLocation && (!sc.breakdownLocations || sc.breakdownLocations.length === 0)) {
        w.push(`Scene ${sc.number} has no primary or breakdown location.`);
      }
      if (!sc.breakdownCharacters || sc.breakdownCharacters.length === 0) {
        w.push(`Scene ${sc.number} has no breakdown characters yet.`);
      }
    }
    return w;
  }, [selectedDay]);

  const [scheduleStripView, setScheduleStripView] = useState(false);

  const createDayMutation = useMutation({
    mutationFn: async () => {
      const today = new Date();
      const res = await fetch(`/api/creator/projects/${projectId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today.toISOString() }),
      });
      if (!res.ok) throw new Error("Failed to create shoot day");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-schedule", projectId] });
      setDraftDays(null);
    },
  });

  const duplicateDayMutation = useMutation({
    mutationFn: async (sourceDayId: string) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const res = await fetch(`/api/creator/projects/${projectId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duplicateFromDayId: sourceDayId,
          date: tomorrow.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to duplicate shoot day");
      return res.json() as Promise<ScheduleResponse>;
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(["project-schedule", projectId], fresh);
      const next = JSON.parse(JSON.stringify(fresh.shootDays)) as ScheduleResponse["shootDays"];
      setDraftDays(next);
      setSavedSchedule(JSON.parse(JSON.stringify(fresh.shootDays)) as ScheduleResponse["shootDays"]);
      setSelectedDayId(next[next.length - 1]?.id ?? null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-schedule", projectId] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { days: any[] }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save schedule");
      return res.json() as Promise<ScheduleResponse>;
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(["project-schedule", projectId], fresh);
      const next = JSON.parse(JSON.stringify(fresh.shootDays)) as ScheduleResponse["shootDays"];
      setDraftDays(next);
      setSavedSchedule(JSON.parse(JSON.stringify(fresh.shootDays)) as ScheduleResponse["shootDays"]);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-schedule", projectId] });
    },
  });

  const deleteDayMutation = useMutation({
    mutationFn: async (dayId: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/schedule?dayId=${encodeURIComponent(dayId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete shoot day");
      return res.json() as Promise<ScheduleResponse>;
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(["project-schedule", projectId], fresh);
      const next = JSON.parse(JSON.stringify(fresh.shootDays)) as ScheduleResponse["shootDays"];
      setDraftDays(next);
      setSavedSchedule(JSON.parse(JSON.stringify(fresh.shootDays)) as ScheduleResponse["shootDays"]);
      setSelectedDayId(next[0]?.id ?? null);
      setExpandedSceneRowId(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-schedule", projectId] });
    },
  });

  const scheduleDirty =
    !!draftDays &&
    !!savedSchedule &&
    scheduleFingerprint(draftDays) !== scheduleFingerprint(savedSchedule);

  const persistSchedule = () => {
    if (!draftDays) return;
    saveMutation.mutate({
      days: draftDays.map((d) => ({
        id: d.id,
        date: d.date,
        unit: d.unit,
        callTime: d.callTime,
        wrapTime: d.wrapTime,
        locationSummary: d.locationSummary,
        status: d.status,
        scenesBeingShot: d.scenesBeingShot ?? null,
        dayNotes: d.dayNotes ?? null,
        scenes: d.scenes.map((s) => ({
          sceneId: s.scene?.id ?? s.sceneId,
          order: s.order,
        })),
      })),
    });
  };

  const updateDayField = (
    id: string,
    field: keyof NonNullable<typeof draftDays>[number],
    value: any
  ) => {
    if (!draftDays) return;
    setDraftDays(
      draftDays.map((d) =>
        d.id === id
          ? {
              ...d,
              [field]:
                field === "date" && typeof value === "string"
                  ? value
                  : value,
            }
          : d
      )
    );
  };

  const updateScenesForDay = (
    id: string,
    scenes: NonNullable<typeof draftDays>[number]["scenes"]
  ) => {
    if (!draftDays) return;
    setDraftDays(
      draftDays.map((d) => (d.id === id ? { ...d, scenes } : d))
    );
  };

  const allScenes = data?.scenes ?? [];

  /** Scenes not assigned to any shoot day (so they can be assigned to the selected day) */
  const assignedSceneIds = new Set(
    draftDays?.flatMap((d) =>
      d.scenes.map((s) => s.scene?.id ?? s.sceneId),
    ) ?? [],
  );
  const unassignedScenes = allScenes.filter((s) => !assignedSceneIds.has(s.id));

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Plan your shoot days, call times, locations, and assign scenes. This schedule feeds call
            sheets and the Production Control Center.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 lg:max-w-[min(100%,36rem)] xl:max-w-none">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 lg:justify-end">
            <span className="mr-auto shrink-0 lg:mr-0">
              {saveMutation.isPending ? "Saving…" : scheduleDirty ? "Unsaved changes" : "Saved"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 text-slate-200 hover:bg-slate-800 text-[11px]"
              disabled={!scheduleDirty || saveMutation.isPending || !draftDays}
              onClick={() => {
                if (savedSchedule) {
                  setDraftDays(JSON.parse(JSON.stringify(savedSchedule)) as ScheduleResponse["shootDays"]);
                }
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white text-[11px]"
              disabled={!scheduleDirty || saveMutation.isPending || !draftDays}
              onClick={() => persistSchedule()}
            >
              Save
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {modoc && draftDays && draftDays.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-[11px]"
                onClick={() => setModocReportOpen(true)}
              >
                <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
                MODOC suggestions
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
              onClick={() => createDayMutation.mutate()}
              disabled={createDayMutation.isPending}
            >
              {createDayMutation.isPending ? "Creating..." : "Add shoot day"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-200 hover:bg-slate-800 text-[11px]"
              disabled={!selectedDay || duplicateDayMutation.isPending}
              title="Copy this day’s times, notes, and scene strip to a new shoot day (tomorrow by default on the server)."
              onClick={() => selectedDay && duplicateDayMutation.mutate(selectedDay.id)}
            >
              {duplicateDayMutation.isPending ? "Duplicating…" : "Duplicate day"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`border-slate-700 text-[11px] ${
                scheduleStripView ? "bg-slate-800 text-white" : "text-slate-200 hover:bg-slate-800"
              }`}
              onClick={() => setScheduleStripView((v) => !v)}
            >
              {scheduleStripView ? "List view" : "Stripboard"}
            </Button>
          </div>
        </div>
        </div>
      </header>

      {hasProject && data && (
        <div className="creator-glass-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm min-w-0">
            <Clapperboard className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              {data.script ? (
                <>
                  <p className="text-slate-200 font-medium truncate">{data.script.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {data.script.sceneCount} scene{data.script.sceneCount === 1 ? "" : "s"} on this script.
                    Schedule rows use project scenes and Script Breakdown (cast, locations, props, etc.) per scene.
                  </p>
                </>
              ) : (
                <p className="text-slate-400 text-xs">
                  No project script yet. Create one in Script Writing so scene headings and breakdown data stay
                  tied to this schedule.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href={`/creator/projects/${projectId}/pre-production/script-writing`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Script writing
            </Link>
            <Link
              href={`/creator/projects/${projectId}/pre-production/script-breakdown`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Script breakdown
            </Link>
            <Link
              href={`/creator/projects/${projectId}/production/call-sheet-generator`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Call sheets
            </Link>
          </div>
        </div>
      )}

      {scheduleWarnings.length > 0 && selectedDay && (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100/90 space-y-1"
          role="status"
        >
          <p className="font-medium text-amber-200/90">Schedule checks</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {scheduleWarnings.slice(0, 6).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {modoc && modocReportOpen && draftDays && (
        <ModocReportModal
          task="schedule"
          reportTitle="MODOC schedule optimization"
          prompt={`Optimize this production schedule. Consider: grouping scenes by location, cast/crew efficiency, minimizing downtime.\n\nScript: ${data?.script ? `${data.script.title} (${data.script.sceneCount} scenes)` : "none"}.\n\nCurrent schedule:\nShoot days: ${JSON.stringify(draftDays.map((d) => ({ date: d.date, unit: d.unit, callTime: d.callTime, wrapTime: d.wrapTime, locationSummary: d.locationSummary, status: d.status, sceneCount: d.scenes?.length ?? 0 })))}.\n\nAvailable scenes (summary): ${JSON.stringify((data?.scenes ?? []).map((s) => ({ number: s.number, heading: s.heading, pages: s.pageCount, status: s.status })))}.\n\nSuggest: day groupings, scene order, location clustering, and 2–4 tips to maximize efficiency and minimize downtime.`}
          onClose={() => setModocReportOpen(false)}
        />
      )}

      {isLoading || !draftDays ? (
        <Skeleton className="h-64 bg-slate-800/60" />
      ) : (
        <div className="space-y-3">
          {scheduleStripView && draftDays.length > 0 && (
            <div className="creator-glass-panel p-3 overflow-x-auto">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Week strip</p>
              <div className="flex gap-2 min-w-min pb-1">
                {draftDays.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDayId(d.id)}
                    className={`shrink-0 w-[112px] rounded-xl border px-2 py-2 text-left text-[10px] transition ${
                      d.id === selectedDay?.id
                        ? "border-orange-500/60 bg-orange-500/10 text-white"
                        : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className="block font-medium text-[11px]">
                      {new Date(d.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="block text-slate-500 mt-1">
                      {d.scenes.length} sc{d.unit ? ` · U${d.unit}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Day list */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Shoot days</p>
            <div className="creator-glass-panel max-h-[420px] overflow-y-auto">
              {draftDays.length === 0 ? (
                <div className="p-4 text-xs text-slate-400">
                  No shoot days yet. Create your first shoot day for this project.
                </div>
              ) : (
                <ul className="p-2 space-y-1 text-xs">
                  {draftDays.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDayId(d.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition ${
                          d.id === selectedDay?.id
                            ? "bg-slate-800 text-white"
                            : "text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px]">
                            {new Date(d.date).toLocaleDateString()} {d.unit ? `· Unit ${d.unit}` : ""}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                            {d.status}
                          </span>
                        </div>
                        {d.locationSummary && (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {d.locationSummary}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Selected day details */}
          <div className="md:col-span-2 space-y-3">
            {selectedDay ? (
              <>
                <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-sm">
                        Shoot day – {new Date(selectedDay.date).toLocaleDateString()}
                      </CardTitle>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 text-red-300 hover:bg-red-500/10 text-[11px]"
                        disabled={deleteDayMutation.isPending}
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            !window.confirm(
                              "Delete this shoot day from the schedule? This cannot be undone.",
                            )
                          ) {
                            return;
                          }
                          deleteDayMutation.mutate(selectedDay.id);
                        }}
                      >
                        {deleteDayMutation.isPending ? "Deleting…" : "Delete shoot day"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 min-w-0">
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                      <div className="space-y-1 min-w-0">
                        <label className="text-slate-400">Date</label>
                        <Input
                          type="date"
                          value={selectedDay.date.slice(0, 10)}
                          onChange={(e) =>
                            updateDayField(
                              selectedDay.id,
                              "date",
                              new Date(e.target.value).toISOString(),
                            )
                          }
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400">Unit</label>
                        <Input
                          value={selectedDay.unit ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "unit", e.target.value || null)
                          }
                          placeholder="A, B..."
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400">Call time</label>
                        <Input
                          value={selectedDay.callTime ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "callTime", e.target.value || null)
                          }
                          placeholder="07:00"
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400">Wrap time</label>
                        <Input
                          value={selectedDay.wrapTime ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "wrapTime", e.target.value || null)
                          }
                          placeholder="18:00"
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1 min-w-0 min-[480px]:col-span-2 lg:col-span-1">
                        <label className="text-slate-400">Status</label>
                        <select
                          value={selectedDay.status}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "status", e.target.value)
                          }
                          className="w-full min-w-0 h-9 rounded-md bg-slate-900 border border-slate-700 px-2 text-[11px] text-white outline-none focus:border-orange-500"
                        >
                          {(
                            [
                              "PLANNED",
                              "CONFIRMED",
                              "SHOOTING",
                              "WRAPPED",
                              "CANCELLED",
                            ] as const
                          ).map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Location summary</label>
                      <textarea
                        rows={2}
                        value={selectedDay.locationSummary ?? ""}
                        onChange={(e) =>
                          updateDayField(
                            selectedDay.id,
                            "locationSummary",
                            e.target.value || null,
                          )
                        }
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                        placeholder="Main location(s) for this day."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">
                        Scenes / coverage (slate notes)
                      </label>
                      <textarea
                        rows={3}
                        value={selectedDay.scenesBeingShot ?? ""}
                        onChange={(e) =>
                          updateDayField(
                            selectedDay.id,
                            "scenesBeingShot",
                            e.target.value.trim() || null,
                          )
                        }
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                        placeholder="e.g. Sc. 4–6, pickups on Sc. 2, second unit plate shots…"
                      />
                      <p className="text-[10px] text-slate-500">
                        Free-text call-sheet style notes; assigned scenes below stay linked to script
                        breakdown.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Day notes</label>
                      <textarea
                        rows={3}
                        value={selectedDay.dayNotes ?? ""}
                        onChange={(e) =>
                          updateDayField(selectedDay.id, "dayNotes", e.target.value || null)
                        }
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                        placeholder="Parking, meals, safety, department heads, basecamp…"
                      />
                    </div>
                  </CardContent>
                </Card>

                {(() => {
                  const sortedDayScenes = selectedDay.scenes
                    .slice()
                    .sort((a, b) => a.order - b.order);
                  const glanceBlocks = [
                    {
                      title: "Cast & characters",
                      rows: dayAggregate.characters.map((c) => ({
                        a: c.name,
                        b: `${c.detail ? `${c.detail} · ` : ""}Sc. ${c.sceneNums.join(", ")}`,
                      })),
                    },
                    {
                      title: "Locations",
                      rows: dayAggregate.locations.map((l) => ({
                        a: l.name,
                        b: `${l.detail ? `${l.detail} · ` : ""}Sc. ${l.sceneNums.join(", ")}`,
                      })),
                    },
                    {
                      title: "Props",
                      rows: dayAggregate.props.map((p) => ({
                        a: p.name + (p.special ? " ★" : ""),
                        b: `Sc. ${p.sceneNums.join(", ")}`,
                      })),
                    },
                    {
                      title: "Wardrobe",
                      rows: dayAggregate.wardrobes.map((w) => ({
                        a: w.character || "—",
                        b: `${w.text} · Sc. ${w.sceneNums.join(", ")}`,
                      })),
                    },
                    {
                      title: "Extras",
                      rows: dayAggregate.extras.map((x) => ({
                        a: `${x.qty}×`,
                        b: `${x.text} · Sc. ${x.sceneNums.join(", ")}`,
                      })),
                    },
                    {
                      title: "Vehicles",
                      rows: dayAggregate.vehicles.map((v) => ({
                        a: v.stunt ? "Stunt vehicle" : "Vehicle",
                        b: `${v.text} · Sc. ${v.sceneNums.join(", ")}`,
                      })),
                    },
                    {
                      title: "Stunts",
                      rows: dayAggregate.stunts.map((s) => ({
                        a: s.text,
                        b: `${s.safety ? `${s.safety} · ` : ""}Sc. ${s.sceneNums.join(", ")}`,
                      })),
                    },
                    {
                      title: "SFX",
                      rows: dayAggregate.sfx.map((fx) => ({
                        a: fx.practical ? "Practical" : "SFX",
                        b: `${fx.text} · Sc. ${fx.sceneNums.join(", ")}`,
                      })),
                    },
                  ].filter((b) => b.rows.length > 0);
                  const miniTable = (
                    title: string,
                    rows: { a: string; b: string }[],
                  ) =>
                    rows.length === 0 ? null : (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                          {title}
                        </p>
                        <table className="w-full border-collapse text-[10px]">
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={i} className="border-t border-slate-800/80">
                                <td className="py-1 pr-2 text-slate-300 align-top w-[28%]">{r.a}</td>
                                <td className="py-1 text-slate-400">{r.b}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  return (
                    <>
                      <div className="space-y-2 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-200">Scene strip</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Order reflects shoot order. Expand a row for script breakdown tied to that
                              scene.
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {selectedDay.scenes.length} on this day
                          </span>
                        </div>
                        <div className="creator-glass-panel overflow-x-auto max-h-[min(380px,50vh)] overflow-y-auto">
                          <table className="w-full border-collapse text-[11px] min-w-[640px]">
                            <thead>
                              <tr className="border-b border-slate-800 text-left text-slate-500">
                                <th className="p-2 w-8" aria-label="Expand" />
                                <th className="p-2 w-10">#</th>
                                <th className="p-2 min-w-[180px]">Scene</th>
                                <th className="p-2 w-14 hidden sm:table-cell">Pages</th>
                                <th className="p-2 hidden md:table-cell w-24">Status</th>
                                <th className="p-2 hidden lg:table-cell min-w-[140px]">
                                  Location
                                </th>
                                <th className="p-2 text-center w-12 hidden md:table-cell">Cast</th>
                                <th className="p-2 text-center w-12 hidden md:table-cell">Props</th>
                                <th className="p-2 text-right w-32">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedDayScenes.length === 0 ? (
                                <tr>
                                  <td colSpan={9} className="p-4 text-slate-500">
                                    No scenes on this day yet. Add rows from the unassigned table below.
                                  </td>
                                </tr>
                              ) : (
                                sortedDayScenes.map((link, index) => {
                                  const sc = link.scene;
                                  const expanded = expandedSceneRowId === link.id;
                                  return (
                                    <Fragment key={link.id}>
                                      <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                                        <td className="p-1 align-middle">
                                          <button
                                            type="button"
                                            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                                            title={sc ? "Show breakdown" : "Scene missing"}
                                            disabled={!sc}
                                            onClick={() =>
                                              setExpandedSceneRowId(expanded ? null : link.id)
                                            }
                                          >
                                            {expanded ? (
                                              <ChevronDown className="w-4 h-4" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4" />
                                            )}
                                          </button>
                                        </td>
                                        <td className="p-2 text-slate-300 font-mono tabular-nums">
                                          {sc?.number ?? "—"}
                                        </td>
                                        <td className="p-2 text-slate-100">
                                          {sc ? (
                                            <>
                                              <span className="line-clamp-2">
                                                {sc.heading || "Untitled scene"}
                                              </span>
                                              {sc.summary && (
                                                <span className="block text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                                                  {sc.summary}
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            <span className="text-amber-400/90">
                                              Scene was removed — remove this row or re-save script
                                              scenes.
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-2 text-slate-400 hidden sm:table-cell">
                                          {sc?.pageCount != null ? String(sc.pageCount) : "—"}
                                        </td>
                                        <td className="p-2 text-slate-400 hidden md:table-cell">
                                          {sc?.status ?? "—"}
                                        </td>
                                        <td className="p-2 text-slate-400 hidden lg:table-cell">
                                          {sc?.primaryLocation?.name ?? "—"}
                                        </td>
                                        <td className="p-2 text-center text-slate-400 hidden md:table-cell">
                                          {sc ? sc.breakdownCharacters.length : "—"}
                                        </td>
                                        <td className="p-2 text-center text-slate-400 hidden md:table-cell">
                                          {sc ? sc.breakdownProps.length : "—"}
                                        </td>
                                        <td className="p-2 text-right whitespace-nowrap">
                                          <button
                                            type="button"
                                            className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
                                            title="Earlier"
                                            disabled={index === 0}
                                            onClick={() => {
                                              const next = sortedDayScenes.slice();
                                              [next[index - 1], next[index]] = [
                                                next[index],
                                                next[index - 1],
                                              ];
                                              updateScenesForDay(
                                                selectedDay.id,
                                                next.map((l, i) => ({ ...l, order: i })),
                                              );
                                            }}
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            className="px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
                                            title="Later"
                                            disabled={index === sortedDayScenes.length - 1}
                                            onClick={() => {
                                              const next = sortedDayScenes.slice();
                                              [next[index], next[index + 1]] = [
                                                next[index + 1],
                                                next[index],
                                              ];
                                              updateScenesForDay(
                                                selectedDay.id,
                                                next.map((l, i) => ({ ...l, order: i })),
                                              );
                                            }}
                                          >
                                            ↓
                                          </button>
                                          <button
                                            type="button"
                                            className="text-[10px] text-red-400 hover:text-red-300 ml-1"
                                            onClick={() => {
                                              const next = sortedDayScenes.filter((_, i) => i !== index);
                                              updateScenesForDay(
                                                selectedDay.id,
                                                next.map((l, i) => ({ ...l, order: i })),
                                              );
                                              if (expandedSceneRowId === link.id) {
                                                setExpandedSceneRowId(null);
                                              }
                                            }}
                                          >
                                            Remove
                                          </button>
                                        </td>
                                      </tr>
                                      {expanded && sc && (
                                        <tr className="bg-slate-900/70 border-b border-slate-800">
                                          <td colSpan={9} className="p-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {miniTable(
                                                "Cast",
                                                sc.breakdownCharacters.map((c) => ({
                                                  a: c.name,
                                                  b: [c.importance, c.description]
                                                    .filter(Boolean)
                                                    .join(" · ") || "—",
                                                })),
                                              )}
                                              {miniTable(
                                                "Locations",
                                                [
                                                  ...(sc.primaryLocation
                                                    ? [
                                                        {
                                                          a: `${sc.primaryLocation.name} (primary)`,
                                                          b:
                                                            sc.primaryLocation.description || "—",
                                                        },
                                                      ]
                                                    : []),
                                                  ...sc.breakdownLocations.map((loc) => ({
                                                    a: loc.name,
                                                    b: loc.description || "—",
                                                  })),
                                                ],
                                              )}
                                              {miniTable(
                                                "Props",
                                                sc.breakdownProps.map((p) => ({
                                                  a: p.name + (p.special ? " ★" : ""),
                                                  b: p.description || "—",
                                                })),
                                              )}
                                              {miniTable(
                                                "Wardrobe",
                                                sc.breakdownWardrobes.map((w) => ({
                                                  a: w.character || "—",
                                                  b: w.description,
                                                })),
                                              )}
                                              {miniTable(
                                                "Extras",
                                                sc.breakdownExtras.map((x) => ({
                                                  a: `${x.quantity}×`,
                                                  b: x.description,
                                                })),
                                              )}
                                              {miniTable(
                                                "Vehicles",
                                                sc.breakdownVehicles.map((v) => ({
                                                  a: v.stuntRelated ? "Stunt" : "Vehicle",
                                                  b: v.description,
                                                })),
                                              )}
                                              {miniTable(
                                                "Stunts",
                                                sc.breakdownStunts.map((st) => ({
                                                  a: st.description,
                                                  b: st.safetyNotes || "—",
                                                })),
                                              )}
                                              {miniTable(
                                                "SFX",
                                                sc.breakdownSfxs.map((fx) => ({
                                                  a: fx.practical ? "Practical" : "SFX",
                                                  b: fx.description,
                                                })),
                                              )}
                                            </div>
                                            {sc.script && (
                                              <p className="text-[10px] text-slate-500 mt-3">
                                                Script: {sc.script.title}
                                              </p>
                                            )}
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              Unassigned project scenes
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Pulled from the same scene list as your script; add to this shoot day to
                              link breakdown data.
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {unassignedScenes.length} available
                          </span>
                        </div>
                        <div className="creator-glass-panel overflow-x-auto max-h-[min(280px,40vh)] overflow-y-auto">
                          <table className="w-full border-collapse text-[11px] min-w-[520px]">
                            <thead>
                              <tr className="border-b border-slate-800 text-left text-slate-500">
                                <th className="p-2">Scene</th>
                                <th className="p-2 hidden sm:table-cell">Pages</th>
                                <th className="p-2 hidden md:table-cell">Script</th>
                                <th className="p-2 hidden lg:table-cell">Location</th>
                                <th className="p-2 text-right w-28"> </th>
                              </tr>
                            </thead>
                            <tbody>
                              {unassignedScenes.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-4 text-slate-500">
                                    All project scenes are on a shoot day.
                                  </td>
                                </tr>
                              ) : (
                                unassignedScenes.map((scene) => (
                                  <tr
                                    key={scene.id}
                                    className="border-b border-slate-800/80 hover:bg-slate-900/40"
                                  >
                                    <td className="p-2 text-slate-100">
                                      <span className="font-mono text-slate-400 mr-1.5">
                                        {scene.number}
                                      </span>
                                      {scene.heading || "Untitled"}
                                    </td>
                                    <td className="p-2 text-slate-400 hidden sm:table-cell">
                                      {scene.pageCount != null ? String(scene.pageCount) : "—"}
                                    </td>
                                    <td className="p-2 text-slate-400 hidden md:table-cell truncate max-w-[120px]">
                                      {scene.script?.title ?? "—"}
                                    </td>
                                    <td className="p-2 text-slate-400 hidden lg:table-cell truncate max-w-[140px]">
                                      {scene.primaryLocation?.name ?? "—"}
                                    </td>
                                    <td className="p-2 text-right">
                                      <button
                                        type="button"
                                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                                        onClick={() => {
                                          const sorted = selectedDay.scenes
                                            .slice()
                                            .sort((a, b) => a.order - b.order);
                                          const nextOrder = sorted.length;
                                          updateScenesForDay(selectedDay.id, [
                                            ...selectedDay.scenes,
                                            {
                                              id: `${selectedDay.id}-${scene.id}`,
                                              sceneId: scene.id,
                                              order: nextOrder,
                                              scene,
                                            },
                                          ]);
                                        }}
                                      >
                                        Add to this day
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Day at a glance</CardTitle>
                          <p className="text-[11px] text-slate-500 font-normal mt-1">
                            Combined breakdown across all scenes scheduled this day (from Script
                            Breakdown).
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4 text-[11px]">
                          {glanceBlocks.length === 0 ? (
                            <p className="text-slate-500 py-2">
                              No breakdown items yet for these scenes. Add characters, props, and
                              locations in{" "}
                              <Link
                                href={`/creator/projects/${projectId}/pre-production/script-breakdown`}
                                className="text-orange-400 hover:underline"
                              >
                                Script Breakdown
                              </Link>
                              .
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              {glanceBlocks.map((block) => (
                                <div
                                  key={block.title}
                                  className="rounded-xl border border-slate-800/80 overflow-hidden"
                                >
                                  <div className="px-3 py-2 bg-slate-900/80 text-slate-300 text-xs font-medium border-b border-slate-800">
                                    {block.title}
                                  </div>
                                  <div className="max-h-48 overflow-y-auto">
                                    <table className="w-full border-collapse text-[11px]">
                                      <tbody>
                                        {block.rows.map((r, i) => (
                                          <tr key={i} className="border-t border-slate-800/60">
                                            <td className="p-2 align-top text-slate-200 w-[36%]">
                                              {r.a}
                                            </td>
                                            <td className="p-2 align-top text-slate-400">{r.b}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
                Select a shoot day on the left or create one to begin scheduling.
              </div>
            )}
          </div>
        </div>
          </div>
      )}
    </div>
  );
}

// --- Casting Portal ---
function CastingPortalWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["project-casting", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/casting`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: invitationsData } = useQuery({
    queryKey: ["project-casting-invitations", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/casting/invitations`).then((r) => r.json()),
    enabled: hasProject,
  });
  const roles = (rolesData?.roles ?? []) as {
    id: string;
    name: string;
    description: string | null;
    status: string;
    invitationsCount: number;
    castInvitations: number;
  }[];
  const invitations = (invitationsData ?? []) as {
    id: string;
    status: string;
    createdAt: string;
    role: { id: string; name: string };
    castingAgency: { id: string; agencyName: string } | null;
    talent: { id: string; name: string } | null;
  }[];
  const rolesContext =
    roles.length > 0
      ? roles.map((r) => `${r.name}${r.description ? `: ${r.description}` : ""} (${r.status})`).join("\n")
      : "No casting roles yet. Add roles or sync from Script Breakdown.";
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/casting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create role");
      }
      return res.json() as Promise<{ role: { id: string; name: string; description: string | null; status: string } }>;
    },
    onSuccess: (created) => {
      queryClient.setQueryData(
        ["project-casting", projectId],
        (prev: any) => {
          const prevRoles = Array.isArray(prev?.roles) ? prev.roles : [];
          return {
            ...(prev || {}),
            roles: [
              ...prevRoles,
              {
                id: created.role.id,
                name: created.role.name,
                description: created.role.description,
                status: created.role.status,
                invitationsCount: 0,
                castInvitations: 0,
              },
            ],
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["project-casting", projectId] });
    },
    onError: (err: any) => {
      alert(err?.message || "Could not create role. Make sure you are linked to a project and signed in as a creator.");
    },
  });
  const [newName, setNewName] = useState("");
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Manage roles for this project and link to the Story Time talent ecosystem.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC casting suggestions
            </Button>
          )}
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Role name"
            className="bg-slate-900 border-slate-700 text-sm w-40"
          />
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => {
              if (hasProject && newName.trim()) {
                createMutation.mutate(newName.trim());
                setNewName("");
              }
            }}
            disabled={createMutation.isPending || !hasProject}
            title={!hasProject ? "Link a project above to add roles" : undefined}
          >
            Add role
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-200 hover:bg-slate-800"
            disabled={!hasProject}
            title={!hasProject ? "Link a project above to sync from Script Breakdown" : undefined}
            onClick={async () => {
              if (!hasProject) return;
              const res = await fetch(`/api/creator/projects/${projectId}/casting/sync-from-breakdown`, {
                method: "POST",
              });
              if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["project-casting", projectId] });
              } else {
                const data = await res.json().catch(() => null);
                alert(data?.error || "Could not sync from Script Breakdown. Make sure you have characters saved.");
              }
            }}
          >
            Sync from Script Breakdown
          </Button>
        </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="casting_portal"
          reportTitle="MODOC casting suggestions"
          prompt={`Match actors to our casting roles and suggest audition/communication tips.\n\nCasting roles:\n${rolesContext}\n\nUse the roles and talent provided in your context to suggest actor–role matches and optionally audition scheduling or communication tips.`}
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Casting roles</h3>
              <p className="text-[11px] text-slate-500">
                {roles.length} role{roles.length === 1 ? "" : "s"}
              </p>
            </div>
            {roles.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">
                {!hasProject ? "Link a project above to manage roles." : "No roles yet. Add a role or sync from Script Breakdown."}
              </p>
            ) : (
              <div className="space-y-1.5">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm"
                  >
                    <span className="text-white font-medium">{r.name}</span>
                    <span className="text-xs text-slate-400">
                      {r.status} · {r.invitationsCount} invite(s)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Invitations to casting agencies</h3>
              <p className="text-[11px] text-slate-500">
                {invitations.length} invitation{invitations.length === 1 ? "" : "s"}
              </p>
            </div>
            {invitations.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">
                Once you shortlist talent in the casting portal and send invitations, they will appear here with their status.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-slate-200">
                        {inv.role?.name}{" "}
                        {inv.talent && (
                          <span className="text-slate-400">
                            · <span className="text-violet-300">{inv.talent.name}</span>
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {inv.castingAgency?.agencyName ?? "Unknown agency"} ·{" "}
                        {new Date(inv.createdAt).toISOString().slice(0, 10)}
                      </p>
                    </div>
                    <span
                      className={
                        "px-2 py-0.5 rounded-full text-[10px] font-medium " +
                        (inv.status === "ACCEPTED"
                          ? "bg-green-500/15 text-green-300"
                          : inv.status === "DECLINED"
                          ? "bg-slate-600/40 text-slate-100"
                          : "bg-amber-500/15 text-amber-300")
                      }
                    >
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={hasProject ? `/creator/cast?projectId=${projectId}` : "/creator/cast"}
          className="creator-glass-panel p-4 transition hover:border-orange-400/35"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Browse casting</h3>
          <p className="text-xs text-slate-400">Manage roles, post auditions, shortlist talent.</p>
        </Link>
        <Link
          href="/creator/auditions"
          className="creator-glass-panel p-4 transition hover:border-orange-400/35"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Auditions & callbacks</h3>
          <p className="text-xs text-slate-400">Create and track auditions for this project.</p>
        </Link>
      </div>
    </div>
  );
}

// --- Crew Marketplace ---
function CrewMarketplaceWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-crew", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/crew`).then((r) => r.json()),
    enabled: hasProject,
  });
  const needs = (data?.needs ?? []) as {
    id: string;
    department: string | null;
    role: string;
    seniority: string | null;
    notes: string | null;
    invitationsCount: number;
  }[];
  const needsContext =
    needs.length > 0
      ? needs.map((n) => `${n.role}${n.department ? ` (${n.department})` : ""}${n.seniority ? `, ${n.seniority}` : ""}${n.notes ? ` — ${n.notes}` : ""}`).join("\n")
      : "No crew needs yet. Add a role to start.";
  const createMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to add need");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-crew", projectId] }),
  });
  const [newRole, setNewRole] = useState("");
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Define crew needs for this project and connect to the crew marketplace.
          </p>
        </div>
        <div className="flex gap-2">
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC crew suggestions
            </Button>
          )}
          <Input
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="e.g. DP, Gaffer"
            className="bg-slate-900 border-slate-700 text-sm w-36"
          />
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              if (hasProject && newRole.trim()) {
                createMutation.mutate(newRole.trim());
                setNewRole("");
              }
            }}
            disabled={createMutation.isPending || !hasProject}
            title={!hasProject ? "Link a project above to add crew needs" : undefined}
          >
            Add need
          </Button>
        </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="crew_marketplace"
          reportTitle="MODOC crew suggestions"
          prompt={`Match crew teams and members to our crew needs and suggest hiring steps.\n\nCrew needs:\n${needsContext}\n\nUse the crew needs and available teams/members provided in your context to suggest matches and streamline hiring.`}
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          {needs.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">
              {!hasProject ? "Link a project above to manage crew needs." : "No crew needs yet. Add a role to start."}
            </p>
          ) : (
            needs.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm"
              >
                <span className="text-white">{n.role}</span>
                {n.department && (
                  <span className="text-xs text-slate-400">{n.department}</span>
                )}
                <span className="text-xs text-slate-400">{n.invitationsCount} invite(s)</span>
              </div>
            ))
          )}
        </div>
      )}
      <Link
        href="/creator/crew"
        className="creator-glass-panel block p-4 transition hover:border-emerald-400/35"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Open Crew marketplace</h3>
        <p className="text-xs text-slate-400">Find and invite crew teams for this film.</p>
      </Link>
    </div>
  );
}

// --- Location Marketplace ---
function LocationMarketplaceWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data: breakdown } = useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/breakdown`).then((r) => r.json()),
    enabled: hasProject,
  });
  const locations = (breakdown?.locations ?? []) as { id: string; name: string; description: string | null }[];
  const locationContext =
    locations.length > 0
      ? locations.map((l) => `${l.name}${l.description ? `: ${l.description}` : ""}`).join("\n")
      : "No breakdown locations yet. Add locations in Script Breakdown first.";
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Required locations from your breakdown. Book via the locations workspace.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC location suggestions
            </Button>
          )}
        </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="location_marketplace"
          reportTitle="MODOC location scouting"
          prompt={`Match our breakdown locations to available sites and suggest logistics (accessibility, suitability for filming).\n\nBreakdown locations:\n${locationContext}\n\nUse the location listings and breakdown data provided in your context to suggest matches and logistical notes.`}
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      <div className="creator-glass-panel p-3 space-y-2">
        {locations.length === 0 ? (
          <p className="text-xs text-slate-500 p-4">
            {!hasProject ? "Link a project above to see locations from Script Breakdown." : "Add locations in Script Breakdown first."}
          </p>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm"
            >
              <span className="text-white">{loc.name}</span>
              {loc.description && (
                <span className="text-xs text-slate-400 truncate max-w-[200px]">{loc.description}</span>
              )}
            </div>
          ))
        )}
      </div>
      <Link
        href="/creator/locations"
        className="creator-glass-panel p-4 transition hover:border-orange-400/35 block"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Open Locations</h3>
        <p className="text-xs text-slate-400">Discover, request, and confirm locations.</p>
      </Link>
    </div>
  );
}

// --- Legal & Contracts ---
function LegalContractsWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-contracts", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/contracts`).then((r) => r.json()),
    enabled: hasProject,
  });
  const contracts = (data?.contracts ?? []) as {
    id: string;
    type: string;
    status: string;
    subject: string | null;
    createdAt: string;
    latestVersion: { id: string; version: number } | null;
    signaturesCount: number;
    actor?: { id: string; name: string } | null;
    crewTeam?: { id: string; name: string } | null;
    location?: { id: string; name: string } | null;
    vendorName?: string | null;
  }[];
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState("ACTOR");
  const [newSubject, setNewSubject] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [newTerms, setNewTerms] = useState("");
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          subject: newSubject || null,
          vendorName: newType === "VENDOR" && newVendorName ? newVendorName : null,
          terms: newTerms || "Terms to be added.",
        }),
      });
      if (!res.ok) throw new Error("Failed to create contract");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-contracts", projectId] });
      setShowCreate(false);
      setNewSubject("");
      setNewVendorName("");
      setNewTerms("");
    },
  });
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Central place to create and track contracts for cast, crew, locations, and paid vendors
            like catering and equipment houses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-200"
            onClick={() => {
              setNewType("ACTOR");
              setNewSubject("");
              setNewVendorName("");
              setNewTerms("");
              setShowCreate(true);
            }}
            disabled={!hasProject}
            title={!hasProject ? "Link a project above to create contracts" : undefined}
          >
            Actor
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-200"
            onClick={() => {
              setNewType("CREW");
              setNewSubject("");
              setNewVendorName("");
              setNewTerms("");
              setShowCreate(true);
            }}
            disabled={!hasProject}
          >
            Crew
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-200"
            onClick={() => {
              setNewType("LOCATION");
              setNewSubject("");
              setNewVendorName("");
              setNewTerms("");
              setShowCreate(true);
            }}
            disabled={!hasProject}
          >
            Location
          </Button>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => {
              setNewType("VENDOR");
              setNewSubject("Catering services agreement");
              setNewVendorName("");
              setNewTerms("");
              setShowCreate(true);
            }}
            disabled={!hasProject}
          >
            Catering & Vendors
          </Button>
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC contract review
            </Button>
          )}
        </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="legal_contracts"
          reportTitle="MODOC contract analysis"
          prompt="Analyze our project contracts for compliance with industry standards. Highlight important terms (rights, payment, termination, indemnity, credits) and flag potential issues we should review with legal counsel. Use the contract data provided in your context."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      <p className="text-xs text-slate-500">
        Use <span className="text-slate-200 font-medium">Actor</span>,{" "}
        <span className="text-slate-200 font-medium">Crew</span>, and{" "}
        <span className="text-slate-200 font-medium">Location</span> for people and places on your
        film. Use the{" "}
        <span className="text-orange-400 font-medium">Catering & Vendors</span> button for paid
        companies like catering, equipment rentals, or transport that also tie into your bookings
        and spend.
      </p>
      {showCreate && (
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
            >
              <option value="ACTOR">Actor</option>
              <option value="CREW">Crew</option>
              <option value="LOCATION">Location</option>
              <option value="VENDOR">Vendor</option>
            </select>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Short description (optional)"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-white"
            />
            {newType === "VENDOR" && (
              <input
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                placeholder="Vendor / catering company name"
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-white"
              />
            )}
            <textarea
              value={newTerms}
              onChange={(e) => setNewTerms(e.target.value)}
              rows={4}
              placeholder="Contract terms..."
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => hasProject && createMutation.mutate()}
                disabled={createMutation.isPending || !hasProject}
              >
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          {contracts.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">
              {!hasProject
                ? "Link a project above to manage contracts."
                : "No contracts yet. Use the buttons above to create Actor, Crew, Location, or Catering & Vendor agreements for this project."}
            </p>
          ) : (
            contracts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs md:text-sm"
              >
                <div className="space-y-0.5">
                  <p className="text-white font-medium">
                    {c.type} {c.subject ? <span className="text-slate-300">· {c.subject}</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {c.actor && <span>Actor: {c.actor.name}</span>}
                    {c.crewTeam && <span>{c.actor ? " · " : ""}Crew: {c.crewTeam.name}</span>}
                    {c.location && <span>{(c.actor || c.crewTeam) ? " · " : ""}Location: {c.location.name}</span>}
                    {c.vendorName && <span>{(c.actor || c.crewTeam || c.location) ? " · " : ""}Vendor: {c.vendorName}</span>}
                    {!c.actor && !c.crewTeam && !c.location && !c.vendorName && <span>No linked party yet</span>}
                  </p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-[11px] text-slate-400">
                    {c.status} · v{c.latestVersion?.version ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {c.signaturesCount} signature{c.signaturesCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Funding Hub ---
function FundingHubWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-funding", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/funding`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: budgetData } = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/budget`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: pitchDeckData } = useQuery({
    queryKey: ["project-pitch-deck", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/pitch-deck`).then((r) => r.json()),
    enabled: hasProject,
  });
  const funding = data?.funding as {
    id: string;
    option: string;
    amount: number | null;
    currency: string | null;
    details: string | null;
    status: string;
  } | null;
  const [option, setOption] = useState<"HAS_FUNDING" | "REQUEST_FUNDING">("HAS_FUNDING");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const budgetTotal =
    typeof budgetData?.total === "number"
      ? budgetData.total
      : Array.isArray(budgetData?.lines)
      ? (budgetData.lines as { total: number }[]).reduce((sum, l) => sum + (l.total || 0), 0)
      : null;
  const committedAmount = funding?.amount ?? null;
  const coveragePercent =
    budgetTotal && committedAmount != null && budgetTotal > 0
      ? Math.min(100, Math.round((committedAmount / budgetTotal) * 100))
      : null;
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option,
          amount: amount ? Number(amount) : null,
          currency: "ZAR",
          details: details || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] }),
  });
  useEffect(() => {
    if (funding) {
      setOption(funding.option as "HAS_FUNDING" | "REQUEST_FUNDING");
      setAmount(funding.amount != null ? String(funding.amount) : "");
      setDetails(funding.details ?? "");
    }
  }, [funding?.id]);
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Capture whether this project is already funded or actively seeking funding, and keep the headline numbers in one place.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {modoc && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
                onClick={() => setModocReportOpen(true)}
              >
                <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
                Get MODOC funding suggestions
              </Button>
            )}
          </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="funding_hub"
          reportTitle="MODOC funding and proposals"
          prompt="Identify potential funding sources and investor types for our project, and suggest how to structure a funding proposal. Use the project details (logline, budget, funding status) in your context. Suggest categories (grants, broadcasters, equity, brands, crowdfunding) and key points to include in proposals—do not invent specific fund names unless provided."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      {hasProject && (budgetTotal || committedAmount != null) && (
        <div className="creator-glass-panel p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-slate-200">
            <span className="font-medium text-slate-100">Funding vs Budget</span>
            <div className="flex flex-wrap gap-3">
              {budgetTotal != null && (
                <span className="text-slate-300">
                  Budget: <span className="font-semibold">ZAR {budgetTotal.toLocaleString()}</span>
                </span>
              )}
              {committedAmount != null && (
                <span className="text-slate-300">
                  {option === "HAS_FUNDING" ? "Committed" : "Target"}:{" "}
                  <span className="font-semibold">ZAR {committedAmount.toLocaleString()}</span>
                </span>
              )}
              {budgetTotal != null && committedAmount != null && (
                <span className="text-slate-300">
                  Gap:{" "}
                  <span className="font-semibold">
                    ZAR {(budgetTotal - committedAmount).toLocaleString()}
                  </span>
                </span>
              )}
            </div>
          </div>
          {coveragePercent != null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Coverage</span>
                <span className="font-medium text-emerald-400">{coveragePercent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs mt-1">
            {budgetTotal == null && (
              <Link
                href={
                  projectId
                    ? `/creator/projects/${projectId}/pre-production/budget-builder`
                    : "/creator/pre/budget-builder"
                }
                className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 hover:border-orange-500/70 hover:text-orange-300 text-slate-300"
              >
                Set up budget in Budget Builder
              </Link>
            )}
            {pitchDeckData?.deck && (
              <Link
                href={
                  projectId
                    ? `/creator/projects/${projectId}/pre-production/pitch-deck-builder`
                    : "/creator/pre/pitch-deck-builder"
                }
                className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 hover:border-orange-500/70 hover:text-orange-300 text-slate-300"
              >
                Open Pitch Deck for this project
              </Link>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-32 bg-slate-800/60" />
      ) : (
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  checked={option === "HAS_FUNDING"}
                  onChange={() => setOption("HAS_FUNDING")}
                  className="rounded"
                />
                Already funded
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  checked={option === "REQUEST_FUNDING"}
                  onChange={() => setOption("REQUEST_FUNDING")}
                  className="rounded"
                />
                Seeking funding
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Headline amount (ZAR)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Total committed or target amount"
                className="bg-slate-900 border-slate-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Funding details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                placeholder={
                  option === "HAS_FUNDING"
                    ? "Who is funding this (grants, investors, broadcasters), and on what terms?"
                    : "Where do you plan to raise from (funds, brands, broadcasters) and what are you asking for?"
                }
              />
            </div>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => hasProject && saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasProject}
              title={!hasProject ? "Link a project above to save" : undefined}
            >
              Save funding snapshot
            </Button>
            {funding?.status && (
              <p className="text-xs text-slate-400">Status: {funding.status}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Pitch Deck Builder ---
function PitchDeckWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-pitch-deck", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/pitch-deck`).then((r) => r.json()),
    enabled: hasProject,
  });
  const deck = data?.deck as {
    id: string;
    template: string;
    title: string | null;
    slides: { id: string; sortOrder: number; title: string | null; body: string | null; mediaUrl: string | null }[];
  } | null;
  const [template, setTemplate] = useState("SHORT_FILM");
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/pitch-deck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (!res.ok) throw new Error("Failed to create deck");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-pitch-deck", projectId] }),
  });
  const slides = deck?.slides ?? [];
  const activeSlide = slides.find((s) => s.id === selectedSlideId) ?? slides[0];

  useEffect(() => {
    if (!deck || !activeSlide) return;
    setSelectedSlideId(activeSlide.id);
    setEditingTitle(activeSlide.title ?? "");
    setEditingBody(activeSlide.body ?? "");
  }, [deck?.id, activeSlide?.id]);

  const updateSlidesMutation = useMutation({
    mutationFn: async (updated: { id: string; sortOrder?: number; title?: string | null; body?: string | null }) => {
      if (!deck) throw new Error("No deck loaded");
      const payloadSlides = deck.slides.map((s) => ({
        id: s.id,
        sortOrder: updated.sortOrder !== undefined && s.id === updated.id ? updated.sortOrder : s.sortOrder,
        title: updated.title !== undefined && s.id === updated.id ? updated.title : s.title,
        body: updated.body !== undefined && s.id === updated.id ? updated.body : s.body,
        mediaUrl: s.mediaUrl,
      }));
      const res = await fetch(`/api/creator/projects/${projectId}/pitch-deck`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: payloadSlides }),
      });
      if (!res.ok) throw new Error("Failed to update deck");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-pitch-deck", projectId] }),
  });

  if (!hasProject) {
    return (
      <div className="space-y-4">
        <header className="storytime-plan-card p-5 md:p-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
            Pre-production workspace
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Create a pitch deck for this project.</p>
        </header>
        <div className="creator-glass-panel p-4 text-sm text-slate-400">
          Link a project above to create and manage a pitch deck.
        </div>
      </div>
    );
  }
  if (isLoading) return <Skeleton className="h-64 bg-slate-800/60" />;
  if (!deck) {
    return (
      <div className="space-y-4">
        <header className="storytime-plan-card p-5 md:p-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
            Pre-production workspace
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Create a pitch deck for this project.</p>
        </header>
        <div className="flex gap-2 items-center">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
          >
            <option value="SHORT_FILM">Short film</option>
            <option value="FEATURE">Feature</option>
          </select>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            Create pitch deck
          </Button>
        </div>
      </div>
    );
  }

  const moveSlide = (id: string, direction: "up" | "down") => {
    if (!deck.slides.length) return;
    const index = deck.slides.findIndex((s) => s.id === id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= deck.slides.length) return;
    const current = deck.slides[index];
    const target = deck.slides[targetIndex];
    updateSlidesMutation.mutate({ id: current.id, sortOrder: target.sortOrder });
  };

  const saveActiveSlide = () => {
    if (!activeSlide) return;
    updateSlidesMutation.mutate({
      id: activeSlide.id,
      title: editingTitle || null,
      body: editingBody || null,
    });
  };

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
              {deck.title || title}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Template: {deck.template} · {slides.length} slide{slides.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:max-w-xl md:justify-end">
            {modoc && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
                onClick={() => setModocReportOpen(true)}
              >
                <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
                Get MODOC pitch deck help
              </Button>
            )}
            <span className="text-xs leading-relaxed text-slate-400">
              Keep this in sync with your script, budget, and funding plan – it&apos;s the version of the story you share with partners.
            </span>
          </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="pitch_deck"
          reportTitle="MODOC pitch deck builder"
          prompt="Help us create or refine our pitch deck. Use the project (title, logline) and current slides in your context. Suggest compelling slide-by-slide content that highlights our project's unique aspects and market potential. Output copy we can paste into our deck."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      <div className="grid gap-4 md:grid-cols-[240px,minmax(0,1fr)]">
        <div className="creator-glass-panel p-2 space-y-1 max-h-[420px] overflow-y-auto">
          {slides.length === 0 ? (
            <p className="text-xs text-slate-500 p-3">
              No slides yet. Use the template options above to generate a starting deck.
            </p>
          ) : (
            slides
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s, i) => {
                const isActive = s.id === activeSlide?.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlideId(s.id);
                      setEditingTitle(s.title ?? "");
                      setEditingBody(s.body ?? "");
                    }}
                    className={[
                      "w-full text-left rounded-xl px-3 py-2 text-xs border transition",
                      isActive
                        ? "bg-orange-500/20 border-orange-500/70 text-white"
                        : "bg-slate-900/70 border-slate-800 text-slate-200 hover:border-orange-500/50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">Slide {i + 1}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="px-1 text-[10px] rounded border border-slate-700 text-slate-300 hover:border-slate-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSlide(s.id, "up");
                          }}
                          disabled={i === 0 || updateSlidesMutation.isPending}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="px-1 text-[10px] rounded border border-slate-700 text-slate-300 hover:border-slate-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveSlide(s.id, "down");
                          }}
                          disabled={i === slides.length - 1 || updateSlidesMutation.isPending}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs font-medium truncate">
                      {s.title || "Untitled slide"}
                    </div>
                  </button>
                );
              })
          )}
        </div>

        <div className="creator-glass-panel p-4 space-y-3">
          {activeSlide ? (
            <>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Slide title</label>
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  placeholder="e.g. Logline, The Team, Budget & Timeline"
                  className="bg-slate-900 border-slate-700 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Slide body</label>
                <textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  rows={8}
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                  placeholder="Summarise this part of the pitch. Think in bullet points or short paragraphs you could speak to."
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  Changes save per slide. You can export or retype this into your favourite deck tool later.
                </p>
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={saveActiveSlide}
                  disabled={updateSlidesMutation.isPending}
                >
                  Save slide
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              No slides selected. Use the panel on the left to pick a slide to edit.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Table Reads ---
function TableReadsWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-table-reads", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/table-reads`).then((r) => r.json()),
    enabled: hasProject,
  });
  const sessions = (data?.sessions ?? []) as {
    id: string;
    name: string | null;
    scheduledAt: string | null;
    createdAt: string;
    participants: {
      id: string;
      user: { id: string; name: string | null; email: string | null } | null;
      characterName: string | null;
    }[];
    notes: {
      id: string;
      body: string;
      createdAt: string;
      user: { id: string; name: string | null } | null;
    }[];
  }[];
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/table-reads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New table read" }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-table-reads", projectId] }),
  });
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Schedule table reads, see who&apos;s reading which characters, and capture notes per session.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC table read insights
            </Button>
          )}
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => hasProject && createMutation.mutate()}
            disabled={createMutation.isPending || !hasProject}
            title={!hasProject ? "Link a project above to create sessions" : undefined}
          >
            New session
          </Button>
        </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="table_reads"
          reportTitle="MODOC table read facilitation"
          prompt="Help us run better table reads. Use the script and table read sessions in your context. Analyze dialogue and character interactions, suggest pacing improvements, and advise on scheduling participants and capturing notes so the team stays aligned."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">
              {!hasProject
                ? "Link a project above to manage table reads."
                : "No table read sessions yet. Create one to start capturing reactions to the script."}
            </p>
          ) : (
            sessions.map((s) => (
              <details
                key={s.id}
                className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm group"
              >
                <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
                  <div className="flex flex-col">
                    <span className="text-white">{s.name || "Unnamed session"}</span>
                    <span className="text-[11px] text-slate-500">
                      {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : "No date set"}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 space-y-0.5">
                    <p>{s.participants?.length ?? 0} participants</p>
                    <p>{s.notes?.length ?? 0} note{s.notes?.length === 1 ? "" : "s"}</p>
                  </div>
                </summary>
                <div className="mt-2 border-t border-slate-800 pt-2 space-y-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
                      Participants
                    </p>
                    {s.participants.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        No participants captured yet. You can still take notes for this session.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-[11px] text-slate-300">
                        {s.participants.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-2">
                            <span>
                              {p.user?.name || p.user?.email || "Unknown"}
                              {p.characterName && (
                                <span className="text-slate-500"> · as {p.characterName}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
                      Notes
                    </p>
                    {s.notes.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        No notes have been captured yet. Use the notes API from set or your own tools to push
                        reactions, line changes, and performance comments here.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-[11px] text-slate-200">
                        {s.notes
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                          )
                          .map((n) => (
                            <li
                              key={n.id}
                              className="rounded-lg bg-slate-900/80 border border-slate-800 px-2 py-1.5"
                            >
                              <p className="whitespace-pre-wrap">{n.body}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {n.user?.name || "Someone"} ·{" "}
                                {new Date(n.createdAt).toLocaleTimeString()}
                              </p>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Production Workspace (tasks + activity) ---
function ProductionWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/tasks`).then((r) => r.json()),
    enabled: hasProject,
  });
  const tasks = (tasksData?.tasks ?? []) as { id: string; title: string; status: string; department: string | null }[];
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Central hub: tasks and coordination for this film.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {modoc && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
                onClick={() => setModocReportOpen(true)}
              >
                <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
                Get MODOC production alignment
              </Button>
            )}
          </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="production_workspace"
          reportTitle="MODOC production workspace"
          prompt="Help us keep the production team aligned. Use our tasks and schedule in your context. Suggest how to manage documentation, share schedules and updates, and highlight any gaps (missing tasks, unclear ownership) so everyone stays informed before and during production."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {tasksLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">
              {!hasProject ? "Link a project above to see tasks." : "No tasks yet. Add tasks from other tools or here."}
            </p>
          ) : (
            tasks.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm"
              >
                <span className="text-white">{t.title}</span>
                <span className="text-xs text-slate-400">{t.status}</span>
              </div>
            ))
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Use On-Set Task Management in Production for day-of tasks. Create tasks via the tasks API.
      </p>
    </div>
  );
}

// --- Equipment Planning ---
function EquipmentPlanningWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-equipment-plan", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/equipment-plan`).then((r) => r.json()),
    enabled: hasProject,
  });
  const items = (data?.items ?? []) as {
    id: string;
    department: string | null;
    category: string;
    description: string | null;
    quantity: number;
    notes: string | null;
  }[];
  const [newCategory, setNewCategory] = useState("");
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/equipment-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory || "Equipment" }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment-plan", projectId] });
      setNewCategory("");
    },
  });
  const equipmentContext =
    items.length > 0
      ? items.map((i) => `${i.category} (qty: ${i.quantity})${i.department ? `, dept: ${i.department}` : ""}${i.notes ? ` — ${i.notes}` : ""}`).join("\n")
      : "No equipment plan items yet.";
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Plan equipment needs and link to Story Time equipment providers.
          </p>
        </div>
        <div className="flex gap-2">
          {modoc && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
              onClick={() => setModocReportOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
              Get MODOC equipment recommendations
            </Button>
          )}
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="e.g. Camera, Lighting"
            className="bg-slate-900 border-slate-700 text-sm w-40"
          />
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => hasProject && createMutation.mutate()}
            disabled={createMutation.isPending || !hasProject}
            title={!hasProject ? "Link a project above to add equipment" : undefined}
          >
            Add item
          </Button>
        </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="equipment_planning"
          reportTitle="MODOC equipment recommendations"
          prompt={`Recommend equipment and match our plan to available listings for optimal production quality.\n\nCurrent equipment plan:\n${equipmentContext}\n\nUse the equipment plan and listings provided in your context to suggest categories and specific listings.`}
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-3 space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">
              {!hasProject ? "Link a project above to plan equipment." : "No equipment planned yet."}
            </p>
          ) : (
            items.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm"
              >
                <span className="text-white">{i.category}</span>
                <span className="text-xs text-slate-400">Qty: {i.quantity}</span>
              </div>
            ))
          )}
        </div>
      )}
      <Link
        href="/creator/equipment"
        className="creator-glass-panel p-4 transition hover:border-orange-400/35 block"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Open Equipment marketplace</h3>
        <p className="text-xs text-slate-400">Find cameras, lighting, audio, and more.</p>
      </Link>
    </div>
  );
}

// --- Risk & Insurance ---
function RiskInsuranceWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-risk", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/risk`).then((r) => r.json()),
    enabled: hasProject,
  });
  const plan = data?.plan as {
    id: string;
    summary: string | null;
    items: { id: string; category: string; description: string; status: string }[];
  } | null;
  const [newCategory, setNewCategory] = useState("SAFETY");
  const [newDesc, setNewDesc] = useState("");
  const saveMutation = useMutation({
    mutationFn: async (newItem: { category: string; description: string }) => {
      const existing = (plan?.items ?? []).map((i) => ({
        id: i.id,
        category: i.category,
        description: i.description,
        status: i.status,
      }));
      const res = await fetch(`/api/creator/projects/${projectId}/risk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [...existing, { category: newItem.category, description: newItem.description }],
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-risk", projectId] });
      setNewDesc("");
    },
  });
  const addItem = () => {
    if (hasProject && newDesc.trim()) {
      saveMutation.mutate({ category: newCategory, description: newDesc.trim() });
    }
  };
  if (!hasProject) {
    return (
      <div className="space-y-4">
        <header className="storytime-plan-card p-5 md:p-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
            Pre-production workspace
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Risk checklist: safety, stunts, vehicles, legal, etc.
          </p>
        </header>
        <div className="creator-glass-panel p-4 text-sm text-slate-400">
          Link a project above to manage risk and insurance items.
        </div>
      </div>
    );
  }
  if (isLoading || !plan) return <Skeleton className="h-64 bg-slate-800/60" />;
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Risk checklist: safety, stunts, vehicles, legal, etc.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {modoc && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
                onClick={() => setModocReportOpen(true)}
              >
                <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
                Get MODOC risk assessment
              </Button>
            )}
          </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="risk_insurance"
          reportTitle="MODOC risk and insurance"
          prompt="Assess our production risks and suggest insurance and contingency plans. Use our risk checklist and breakdown (stunts, vehicles) in your context. Recommend types of coverage to consider and mitigation steps; frame as points to discuss with our broker or legal counsel."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      <div className="flex gap-2 flex-wrap">
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
        >
          <option value="SAFETY">Safety</option>
          <option value="STUNTS">Stunts</option>
          <option value="VEHICLES">Vehicles</option>
          <option value="LEGAL">Legal</option>
        </select>
        <Input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Description"
          className="bg-slate-900 border-slate-700 text-sm flex-1 min-w-[120px]"
        />
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={addItem} disabled={saveMutation.isPending || !hasProject}>
          Add
        </Button>
      </div>
      <div className="creator-glass-panel p-3 space-y-2">
        {plan.items.length === 0 ? (
          <p className="text-xs text-slate-500 p-4">No risk items yet.</p>
        ) : (
          plan.items.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm"
            >
              <span className="text-white">{i.category}: {i.description}</span>
              <span className="text-xs text-slate-400">{i.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Production Readiness ---
function ProductionReadinessWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["project-readiness", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/readiness`).then((r) => r.json()),
    enabled: hasProject,
  });
  const checklist = data?.checklist as Record<string, boolean> | null;
  const percent = data?.readinessPercent as number | undefined;
  const metrics = data?.metrics as
    | {
        scriptSceneCount: number;
        breakdownSceneCoveragePercent: number | null;
        scheduledShootDayCount: number;
        shootDaysWithoutCallSheet: number;
        unsignedContractCount: number;
        openRiskItemCount: number;
      }
    | undefined;
  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
              Production Readiness Dashboard
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Final checklist before moving to Production.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {modoc && hasProject && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
                onClick={() => setModocReportOpen(true)}
              >
                <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
                Get MODOC readiness assessment
              </Button>
            )}
          </div>
        </div>
      </header>
      {modoc && modocReportOpen && hasProject && (
        <ModocReportModal
          task="production_readiness"
          reportTitle="MODOC production readiness"
          prompt="Assess our production readiness from the checklist in your context. Summarize what's in place and what's missing, highlight areas that need attention before we shoot, and suggest priorities (e.g. lock cast and crew first, then locations, then equipment) so we can move to production with confidence."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}
      {!hasProject ? (
        <div className="creator-glass-panel p-4 text-sm text-slate-400">
          Link a project above to see the readiness checklist.
        </div>
      ) : isLoading ? (
        <Skeleton className="h-32 bg-slate-800/60" />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
            <span>Readiness</span>
            <span className="font-medium text-emerald-400">{percent ?? 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {checklist && Object.entries(checklist).map(([key, done]) => (
              <li key={key} className={done ? "text-emerald-400" : "text-slate-500"}>
                {done ? "✓" : "○"} {key.replace(/^has/, "").replace(/([A-Z])/g, " $1").trim()}
              </li>
            ))}
          </ul>
          {metrics && projectId && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2 text-[11px] text-slate-400">
              <p className="font-medium text-slate-300 text-xs">Live counts</p>
              <ul className="space-y-1">
                <li>Project scenes: {metrics.scriptSceneCount}</li>
                <li>
                  Breakdown rows tied to a scene:{" "}
                  {metrics.breakdownSceneCoveragePercent != null
                    ? `${metrics.breakdownSceneCoveragePercent}%`
                    : "—"}
                </li>
                <li>Scheduled shoot days: {metrics.scheduledShootDayCount}</li>
                <li>Days without a saved call sheet: {metrics.shootDaysWithoutCallSheet}</li>
                <li>Contracts not fully closed: {metrics.unsignedContractCount}</li>
                <li>Open risk checklist items: {metrics.openRiskItemCount}</li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/creator/projects/${projectId}/pre-production/script-writing`}
                  className="text-orange-400 hover:underline"
                >
                  Script
                </Link>
                <Link
                  href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
                  className="text-orange-400 hover:underline"
                >
                  Schedule
                </Link>
                <Link
                  href={`/creator/projects/${projectId}/production/call-sheet-generator`}
                  className="text-orange-400 hover:underline"
                >
                  Call sheets
                </Link>
              </div>
            </div>
          )}
          <div className="mt-3 creator-glass-panel p-4">
            <ProjectStageControls projectId={projectId!} status="DEVELOPMENT" phase="CONCEPT" />
          </div>
        </>
      )}
    </div>
  );
}

// --- Visual Planning ---
function VisualPlanningWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const hasProject = !!projectId;
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const { data: ideasData } = useQuery({
    queryKey: ["project-ideas", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/ideas`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: breakdown } = useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/breakdown`).then((r) => r.json()),
    enabled: hasProject,
  });
  const { data: schedule } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: () => fetch(`/api/creator/projects/${projectId}/schedule`).then((r) => r.json()),
    enabled: hasProject,
  });

  const ideas = (ideasData?.ideas ?? []) as { id: string; title: string; moodboardUrls?: string | null }[];
  const characters = (breakdown?.characters ?? []) as { id?: string; name: string; description?: string | null; importance?: string | null }[];
  const locations = (breakdown?.locations ?? []) as { id?: string; name: string; description?: string | null }[];
  const scenes = (schedule?.scenes ?? []) as { id: string; number: string; heading: string | null }[];

  return (
    <div className="space-y-6">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Bring together moodboards, characters, locations, and scenes so the team can see the film at a glance.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {modoc && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs"
                onClick={() => setModocReportOpen(true)}
              >
                <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
                Get MODOC visual planning
              </Button>
            )}
          </div>
        </div>
      </header>
      {modoc && modocReportOpen && (
        <ModocReportModal
          task="visual_planning"
          reportTitle="MODOC visual planning and storyboards"
          prompt="Help us plan visuals for our film. Use the script, scenes, characters, and locations in your context. Suggest: (1) visual storyboard beats for key moments, (2) shot compositions (framing, angles, lens), and (3) camera movements (dolly, pan, handheld, static) that support the story. Be specific to our scenes where possible."
          onClose={() => setModocReportOpen(false)}
          projectId={projectId ?? undefined}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="creator-glass-panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Moodboard ideas</h3>
            <span className="text-[11px] text-slate-500">{ideas.length} idea{ideas.length === 1 ? "" : "s"}</span>
          </div>
          {ideas.length === 0 ? (
            <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">
              No ideas yet. Use Idea Development to add concepts and attach moodboard URLs (Pinterest boards, lookbooks, etc.).
            </p>
          ) : (
            <div className="space-y-1.5">
              {ideas.map((i) => (
                <div key={i.id} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-sm">
                  <span className="text-white">{i.title}</span>
                  {i.moodboardUrls && (
                    <p className="text-xs text-slate-400 mt-1 truncate">{i.moodboardUrls}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="creator-glass-panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Key characters</h3>
            <span className="text-[11px] text-slate-500">{characters.length} character{characters.length === 1 ? "" : "s"}</span>
          </div>
          {characters.length === 0 ? (
            <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">
              Add characters in Script Breakdown to see them here with notes for hair, makeup, wardrobe, and casting.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {characters.map((ch) => (
                <div key={ch.id ?? ch.name} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs">
                  <p className="text-white font-medium text-sm">{ch.name}</p>
                  {ch.importance && <p className="text-[11px] text-violet-300 mt-0.5">{ch.importance}</p>}
                  {ch.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{ch.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="creator-glass-panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Key locations</h3>
            <span className="text-[11px] text-slate-500">{locations.length} location{locations.length === 1 ? "" : "s"}</span>
          </div>
          {locations.length === 0 ? (
            <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">
              Add locations in Script Breakdown first. They will flow into Location Marketplace and bookings, and appear here as your visual location list.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {locations.map((loc) => (
                <div key={loc.id ?? loc.name} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs">
                  <p className="text-white font-medium text-sm">{loc.name}</p>
                  {loc.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{loc.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="creator-glass-panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Scenes & shot planning</h3>
            <span className="text[11px] text-slate-500">{scenes.length} scene{scenes.length === 1 ? "" : "s"}</span>
          </div>
          {scenes.length === 0 ? (
            <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">
              Once you save a script and build a schedule, INT/EXT scene headings will appear here to guide storyboards and shot lists.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {scenes.map((s) => (
                <div key={s.id} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs">
                  <p className="text-white font-medium text-sm">
                    Scene {s.number}{" "}
                    {s.heading && <span className="text-slate-400 ml-1">{s.heading}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


