 "use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Clapperboard, FileText } from "lucide-react";
import { ProjectStageControls } from "../../project-stage-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModocFieldPopover } from "@/components/modoc";
import { ModocBreakdownIncorporateBar } from "@/components/modoc/modoc-breakdown-incorporate-bar";
import { useModocToolRefresh } from "@/components/modoc/use-modoc-tool-refresh";
import { queryKeysForProjectTool } from "@/lib/modoc/project-tool-query-keys";
import { invalidateProjectPipeline } from "@/lib/project-pipeline-invalidation";
import { getActiveBudgetId, setActiveBudgetId } from "@/lib/active-budget";
import { parseScenesFromScreenplay } from "@/lib/scene-parser";
import { parseSluglineMeta } from "@/lib/slugline-meta";
import { VisualPlanningCatalogue } from "@/components/creator/visual-planning-catalogue";
import { LegalContractsWorkspace } from "@/components/project-tools/pre/LegalContractsWorkspace";
import { formatZar } from "@/lib/format-currency-zar";
import { mergeBudgetTemplateWithSaved } from "@/lib/budget-merge";
import {
  budgetRowKey,
  embedBudgetLineKey,
  extractBudgetLineKey,
  stripBudgetLineKey,
} from "@/lib/budget-line-keys";
import {
  BudgetStudioNav,
  friendlyDepartmentName,
  type BudgetWorkspaceId,
} from "@/components/budget/budget-studio-nav";
import { BudgetActualsPanel } from "@/components/budget/budget-actuals-panel";
import { BudgetLinesEditor } from "@/components/budget/budget-lines-editor";
import {
  buildEffectiveSceneLinksForPreview,
  buildShootDayPipelinePreview,
} from "@/lib/schedule-day-preview";
import {
  AUDITION_LISTING_FEE_ZAR,
  CASTING_ACQUISITION_FEE_ZAR,
  EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR,
} from "@/lib/pricing";
import { mutationErrorMessage, projectToolFetch, projectToolQueryFn } from "@/lib/project-tool-fetch";
import { ToolActionError } from "@/components/project-tools/tool-action-error";
import { ScriptWritingStudio } from "@/components/script-studio/script-writing-studio";
import { ScriptReviewStudio } from "@/components/script-review/script-review-studio";
import { LocationMarketplaceCatalog } from "@/components/marketplace/location-marketplace-catalog";
import { EquipmentMarketplaceCatalog } from "@/components/marketplace/equipment-marketplace-catalog";
import { BreakdownStudioShell, type BreakdownStudioTab } from "@/components/breakdown";
import type {
  BreakdownIntelligencePayload,
  CatalogAsset,
  BreakdownCategoryKey,
  BreakdownDepartmentId,
} from "@/lib/breakdown/types";
import type { ScriptRevisionImpact } from "@/lib/breakdown/script-revision-impact";
import type { DepartmentWorkspacePayload } from "@/lib/breakdown/department-workspace";
import { parseScriptReviewNoteBodyV2 } from "@/lib/script-review/notes";
import {
  ToolSavedViewSheet,
  ToolViewButton,
  IdeasSavedViewer,
  ScriptsSavedViewer,
  ScriptReviewsViewer,
  BudgetSavedViewer,
  ScheduleSavedViewer,
  BreakdownSavedViewer,
  TableReadsSavedViewer,
} from "@/components/project-tools";
import { buildStandaloneBudgetStarter } from "@/lib/budget-engine";
import {
  getLocalBudgetDraft,
  saveLocalBudgetDraft,
  type LocalBudgetDraft,
} from "@/lib/budget-local-draft";
import {
  emptyLocalBreakdownDraft,
  getLocalBreakdownDraft,
  saveLocalBreakdownDraft,
} from "@/lib/breakdown-local-draft";
import {
  draftHasNoSceneLinkedItems,
  mergeSeededBreakdownIntoDraft,
  seedBreakdownFromScreenplay,
} from "@/lib/breakdown/seed-from-screenplay";
import {
  consolidateCharacterRows,
  groupCharactersForDisplay,
  normalizeCharacterName,
  uniqueCharacterCount,
} from "@/lib/breakdown/character-identity";

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

  useModocToolRefresh({ queryKeys: queryKeysForProjectTool(tool) });

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
        <ScriptWritingStudio projectId={projectId} title={title} />
      </>
    );
  }

  if (tool === "script-review") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <ScriptReviewStudio projectId={projectId} title={title} />
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
    return <LegalContractsWorkspace projectId={projectId} title={title} />;
  }

  if (tool === "funding-hub") {
    return (
      <>
        {!hasProject && <UnlinkedBanner />}
        <FundingHubWorkspace projectId={projectId} title={title} />
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
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/ideas`),
    enabled: hasProject,
  });

  const ideas = useMemo(
    () =>
      ((data?.ideas ?? []) as {
        id: string;
        title: string;
        logline: string | null;
        notes: string | null;
        genres: string | null;
        convertedToProject: boolean;
        updatedAt: string;
      }[]),
    [data?.ideas],
  );

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
  const [createError, setCreateError] = useState("");

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
  }, [selected]);

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

  const [ideasViewOpen, setIdeasViewOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      return projectToolFetch(`/api/creator/projects/${projectId}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New idea" }),
      });
    },
    onMutate: () => setCreateError(""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-ideas", projectId] });
    },
    onError: (err) => {
      setCreateError(mutationErrorMessage(err, "Could not create idea. Try again."));
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
          <ToolViewButton
            onClick={() => setIdeasViewOpen(true)}
            count={ideas.length}
            disabled={ideas.length === 0}
          />
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={() => {
              if (!hasProject) {
                setCreateError("Link a project above before creating ideas.");
                return;
              }
              createMutation.mutate();
            }}
            disabled={!hasProject || createMutation.isPending}
            title={!hasProject ? "Link a project above to create ideas" : undefined}
          >
            {createMutation.isPending ? "Creating…" : "New idea"}
          </Button>
        </div>
        </div>
      </header>

      <ToolSavedViewSheet
        open={ideasViewOpen}
        onClose={() => setIdeasViewOpen(false)}
        title="Saved ideas"
        subtitle="Browse loglines, genres, and notes from your idea vault."
      >
        <IdeasSavedViewer
          ideas={ideas}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
          }}
        />
      </ToolSavedViewSheet>

      <ToolActionError message={createError} onDismiss={() => setCreateError("")} />

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
  makeups?: { id?: string; notes: string; character?: string | null; sceneId?: string | null }[];
};

type BreakdownCategoryTab =
  | "characters"
  | "props"
  | "locations"
  | "wardrobe"
  | "extras"
  | "vehicles"
  | "stunts"
  | "sfx"
  | "makeups";

type BreakdownTab = "scenes" | BreakdownCategoryTab;

function attachSceneIdToBreakdownRows<T extends { sceneId?: string | null }>(
  rows: T[],
  sid: string | null,
): T[] {
  if (!sid) return rows;
  return rows.map((r) => ({ ...r, sceneId: r.sceneId ?? sid }));
}

/** Match rows linked to a scene; also include unlinked rows so they are not invisible. */
function breakdownRowMatchesScene(
  row: { sceneId?: string | null },
  sceneId: string,
): boolean {
  if (!row.sceneId) return true;
  return row.sceneId === sceneId;
}

function payloadFromBreakdownData(data: Record<string, unknown> | null | undefined): BreakdownPayload {
  const characters = (data?.characters as BreakdownPayload["characters"]) ?? [];
  return {
    characters: consolidateCharacterRows(characters),
    props: (data?.props as BreakdownPayload["props"]) ?? [],
    locations: (data?.locations as BreakdownPayload["locations"]) ?? [],
    wardrobe: (data?.wardrobe as BreakdownPayload["wardrobe"]) ?? [],
    extras: (data?.extras as BreakdownPayload["extras"]) ?? [],
    vehicles: (data?.vehicles as BreakdownPayload["vehicles"]) ?? [],
    stunts: (data?.stunts as BreakdownPayload["stunts"]) ?? [],
    sfx: (data?.sfx as BreakdownPayload["sfx"]) ?? [],
    makeups: (data?.makeups as BreakdownPayload["makeups"]) ?? [],
  };
}

function ScriptBreakdownWorkspace({ projectId, title }: ScriptBreakdownWorkspaceProps) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/breakdown`),
    enabled: hasProject,
  });

  const { data: scriptsData } = useQuery({
    enabled: !!hasProject && !!projectId,
    queryKey: ["creator-scripts-breakdown", projectId],
    queryFn: projectToolQueryFn(`/api/creator/scripts?projectId=${projectId}`),
  });
  const { data: projectScriptData } = useQuery({
    enabled: !!hasProject && !!projectId,
    queryKey: ["project-script-breakdown", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/script`),
  });
  const { data: scriptReviewData } = useQuery({
    enabled: !!hasProject && !!projectId,
    queryKey: ["script-review-note-breakdown", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/script-review`),
  });
  const { data: scenesListData } = useQuery({
    enabled: hasProject,
    queryKey: ["project-scenes", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/scenes`),
  });
  const projectScenesForBreakdownUnsorted = (scenesListData?.scenes ?? []) as {
    id: string;
    number: string;
    heading: string | null;
    storyDay: number | null;
    intExt: string | null;
    timeOfDay: string | null;
    summary: string | null;
  }[];
  const projectScenesForBreakdown = [...projectScenesForBreakdownUnsorted].sort((a, b) => {
    const aNum = Number(a.number);
    const bNum = Number(b.number);
    const aIsNum = Number.isFinite(aNum);
    const bIsNum = Number.isFinite(bNum);
    if (aIsNum && bIsNum && aNum !== bNum) return aNum - bNum;
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
  });
  const projectScripts = useMemo(
    () => ((scriptsData?.scripts ?? []) as Array<{ id: string; title: string; content?: string; updatedAt?: string }>),
    [scriptsData?.scripts],
  );
  const projectScriptTitle = (projectScriptData?.script?.title as string | undefined) ?? "Project script";
  const projectScriptVersions = useMemo(
    () =>
      ((projectScriptData?.script?.versions as Array<{
        id: string;
        versionLabel: string | null;
        content: string;
        createdAt: string;
      }> | undefined) ?? []),
    [projectScriptData?.script?.versions],
  );
  const breakdownScriptOptions = useMemo(
    () => [
      ...projectScriptVersions.map((v) => ({
        id: `project-version:${v.id}`,
        title: projectScriptTitle,
        label: `${projectScriptTitle} · ${v.versionLabel || "Project draft"} · ${new Date(v.createdAt).toLocaleDateString()}`,
        content: v.content ?? "",
      })),
      ...projectScripts.map((s) => ({
        id: `creator-script:${s.id}`,
        title: s.title,
        label: `${s.title} · Library script${s.updatedAt ? ` · ${new Date(s.updatedAt).toLocaleDateString()}` : ""}`,
        content: s.content ?? "",
      })),
    ],
    [projectScriptVersions, projectScriptTitle, projectScripts],
  );
  const [breakdownScriptId, setBreakdownScriptId] = useState<string>("");
  /** Scene used for category tabs: new rows and filtered list (from screenplay sync). */
  const [activeSceneId, setActiveSceneId] = useState<string>("");
  const [sceneSyncMessage, setSceneSyncMessage] = useState<string>("");
  const selectedScript = breakdownScriptId
    ? breakdownScriptOptions.find((s) => s.id === breakdownScriptId) ?? breakdownScriptOptions[0]
    : breakdownScriptOptions[0];
  const parsedReviewNote = parseScriptReviewNoteBodyV2((scriptReviewData?.notes?.body as string) ?? "");
  const latestInternalReviewNote = parsedReviewNote.internalReviews?.[0]?.notes?.trim() ?? "";
  const latestInternalReviewLabel = parsedReviewNote.internalReviews?.[0]?.scriptLabel ?? "";

  useEffect(() => {
    if (breakdownScriptOptions.length > 0 && !breakdownScriptId) {
      setBreakdownScriptId(breakdownScriptOptions[0].id);
    }
  }, [breakdownScriptOptions, breakdownScriptId]);

  useEffect(() => {
    if (projectScenesForBreakdown.length === 0) {
      setActiveSceneId("");
      return;
    }
    setActiveSceneId((prev) => {
      if (prev && projectScenesForBreakdown.some((s) => s.id === prev)) return prev;
      return projectScenesForBreakdown[0].id;
    });
  }, [projectScenesForBreakdown]);

  const latestProjectScriptContent = useMemo(() => {
    const v = projectScriptVersions[0];
    return v?.content ?? "";
  }, [projectScriptVersions]);

  const detectedSceneHeadingsInScript = useMemo(
    () => parseScenesFromScreenplay(latestProjectScriptContent).length,
    [latestProjectScriptContent],
  );
  const syncScenesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/scenes/sync-from-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeOrphans: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not sync scenes");
      return json as { count: number };
    },
    onSuccess: (result) => {
      setSceneSyncMessage(
        result.count > 0
          ? `Synced ${result.count} scene${result.count === 1 ? "" : "s"} from your project screenplay.`
          : "Scenes are up to date with the screenplay.",
      );
      invalidateProjectPipeline(queryClient, projectId, ["scenes"]);
    },
    onError: (error) => {
      setSceneSyncMessage((error as Error).message);
    },
  });

  type SceneEditFields = { storyDay?: string; intExt?: string; timeOfDay?: string; summary?: string };
  const [sceneEdits, setSceneEdits] = useState<Record<string, SceneEditFields>>({});
  const [aiPopulateMessage, setAiPopulateMessage] = useState("");

  const getSceneField = (s: (typeof projectScenesForBreakdown)[0], key: keyof SceneEditFields): string => {
    const o = sceneEdits[s.id]?.[key];
    if (o !== undefined) return o;
    if (key === "storyDay") return s.storyDay != null ? String(s.storyDay) : "";
    if (key === "intExt") return s.intExt ?? "";
    if (key === "timeOfDay") return s.timeOfDay ?? "";
    return s.summary ?? "";
  };

  const setSceneField = (id: string, key: keyof SceneEditFields, value: string) => {
    setSceneEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const saveSceneDetailsMutation = useMutation({
    mutationFn: async (payload: { id: string; storyDay: string; intExt: string; timeOfDay: string; summary: string }) => {
      const storyDayNum =
        payload.storyDay.trim() === "" ? null : Math.floor(Number.parseInt(payload.storyDay, 10));
      if (payload.storyDay.trim() !== "" && !Number.isFinite(storyDayNum)) {
        throw new Error("Story day must be a whole number or empty.");
      }
      const res = await fetch(`/api/creator/projects/${projectId}/scenes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: [
            {
              id: payload.id,
              storyDay: storyDayNum,
              intExt: payload.intExt.trim() || null,
              timeOfDay: payload.timeOfDay.trim() || null,
              summary: payload.summary.trim() || null,
            },
          ],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not save scene");
      return j;
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["project-scenes", projectId] });
      setSceneEdits((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
    },
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async (opts: { mode: "full" | "scenes" }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/breakdown/auto-populate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: opts.mode }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "AI populate failed");
      return j as { warnings?: string[] };
    },
    onSuccess: (out) => {
      setSceneEdits({});
      invalidateProjectPipeline(queryClient, projectId, ["breakdown", "casting"]);
      const w = (out.warnings ?? []).filter(Boolean);
      setAiPopulateMessage(
        w.length > 0 ? `Done. Notes: ${w.slice(0, 6).join(" · ")}${w.length > 6 ? "…" : ""}` : "AI breakdown applied.",
      );
    },
    onError: (e) => {
      setAiPopulateMessage((e as Error).message);
    },
  });

  const [tab, setTab] = useState<BreakdownTab>("scenes");
  const [breakdownViewOpen, setBreakdownViewOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<BreakdownStudioTab>("command");
  const [selectedAsset, setSelectedAsset] = useState<CatalogAsset | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<BreakdownDepartmentId | null>(null);
  const [highlightCategory, setHighlightCategory] = useState<BreakdownCategoryKey | null>(null);
  const [editingSceneMeta, setEditingSceneMeta] = useState(false);
  const [editingCategoryRows, setEditingCategoryRows] = useState(false);

  const openBreakdownEditor = useCallback(
    (sceneId: string, mode: "scene" | "items", category?: BreakdownCategoryTab) => {
      setActiveSceneId(sceneId);
      setStudioTab("editor");
      if (mode === "scene") {
        setTab("scenes");
        setEditingSceneMeta(true);
        setEditingCategoryRows(false);
      } else {
        setTab(category ?? "characters");
        setEditingCategoryRows(true);
        setEditingSceneMeta(false);
      }
    },
    [],
  );

  useEffect(() => {
    setEditingCategoryRows(false);
  }, [tab]);

  useEffect(() => {
    setEditingSceneMeta(false);
  }, [activeSceneId]);

  const { data: intelligenceData, isLoading: intelligenceLoading } = useQuery({
    queryKey: ["project-breakdown-intelligence", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/breakdown/intelligence`),
    enabled: hasProject,
  });
  const intelligence = (intelligenceData ?? null) as BreakdownIntelligencePayload | null;

  const { data: revisionData, isLoading: revisionLoading } = useQuery({
    queryKey: ["project-breakdown-revision-impact", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/breakdown/revision-impact`),
    enabled: hasProject,
  });
  const revisionImpact = ((revisionData as { impact?: ScriptRevisionImpact | null } | null)?.impact ??
    null) as ScriptRevisionImpact | null;

  const { data: departmentWsData, isLoading: departmentWsLoading } = useQuery({
    queryKey: ["project-breakdown-department", projectId, activeDepartment],
    queryFn: projectToolQueryFn(
      `/api/creator/projects/${projectId}/breakdown/departments?department=${activeDepartment}`,
    ),
    enabled: hasProject && !!activeDepartment,
  });
  const departmentWorkspace = ((departmentWsData as { workspace?: DepartmentWorkspacePayload } | null)?.workspace ??
    null) as DepartmentWorkspacePayload | null;

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "revisions") setStudioTab("revisions");
    else if (tabParam === "screenplay") setStudioTab("screenplay");
    else if (tabParam === "departments") setStudioTab("departments");
  }, [searchParams]);

  useEffect(() => {
    if (!hasProject && studioTab !== "editor") setStudioTab("editor");
  }, [hasProject, studioTab]);

  const [draft, setDraft] = useState<BreakdownPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<BreakdownPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const seededFromScriptRef = useRef(false);

  useEffect(() => {
    seededFromScriptRef.current = false;
    setDraft(null);
    setSavedSnapshot(null);
  }, [projectId]);

  const breakdownDirty =
    !!draft &&
    !!savedSnapshot &&
    JSON.stringify(draft) !== JSON.stringify(savedSnapshot);

  // Keep local draft in sync with server breakdown data (unless the user has unsaved edits).
  useEffect(() => {
    if (!hasProject || !data) return;
    if (breakdownDirty) return;
    const initial = payloadFromBreakdownData(data as Record<string, unknown>);
    const serialized = JSON.stringify(initial);
    setDraft((prev) => {
      if (prev && JSON.stringify(prev) === serialized) return prev;
      return initial;
    });
    setSavedSnapshot((prev) => {
      if (prev && JSON.stringify(prev) === serialized) return prev;
      return JSON.parse(serialized) as BreakdownPayload;
    });
  }, [data, hasProject, breakdownDirty]);

  useEffect(() => {
    if (!hasProject && !draft) {
      const stored = getLocalBreakdownDraft();
      const initial = (stored ?? emptyLocalBreakdownDraft()) as BreakdownPayload;
      setDraft(initial);
      setSavedSnapshot(JSON.parse(JSON.stringify(initial)) as BreakdownPayload);
    }
  }, [hasProject, draft]);

  const saveMutation = useMutation({
    mutationFn: async (payload: BreakdownPayload) => {
      const normalized: BreakdownPayload = {
        ...payload,
        characters: consolidateCharacterRows(payload.characters ?? []),
      };
      if (!hasProject) {
        saveLocalBreakdownDraft({
          characters: normalized.characters ?? [],
          props: normalized.props ?? [],
          locations: normalized.locations ?? [],
          wardrobe: normalized.wardrobe ?? [],
          extras: normalized.extras ?? [],
          vehicles: normalized.vehicles ?? [],
          stunts: normalized.stunts ?? [],
          sfx: normalized.sfx ?? [],
          makeups: normalized.makeups ?? [],
        });
        return normalized;
      }
      const res = await fetch(`/api/creator/projects/${projectId}/breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) throw new Error("Failed to save breakdown");
      const data = await res.json();
      return payloadFromBreakdownData(data);
    },
    onMutate: () => setSaving(true),
    onSuccess: (saved) => {
      setDraft(saved);
      setSavedSnapshot(JSON.parse(JSON.stringify(saved)) as BreakdownPayload);
      setSaveMessage("Breakdown saved");
    },
    onError: () => {
      setSaveMessage("Could not save breakdown. Try again.");
    },
    onSettled: () => {
      setSaving(false);
      invalidateProjectPipeline(queryClient, projectId, ["breakdown"]);
    },
  });

  // When scenes exist but nothing is linked to them, seed characters/locations from the screenplay.
  useEffect(() => {
    if (!hasProject || !draft || breakdownDirty || seededFromScriptRef.current) return;
    if (projectScenesForBreakdown.length === 0) return;
    if (!draftHasNoSceneLinkedItems(draft)) {
      seededFromScriptRef.current = true;
      return;
    }

    const scriptContent =
      selectedScript?.content?.trim() || latestProjectScriptContent.trim() || "";
    if (!scriptContent) return;

    const seeded = seedBreakdownFromScreenplay(
      scriptContent,
      projectScenesForBreakdown.map((s) => ({
        id: s.id,
        number: s.number,
        heading: s.heading,
      })),
    );
    const { draft: merged, added } = mergeSeededBreakdownIntoDraft(draft, seeded);
    seededFromScriptRef.current = true;
    if (added === 0) return;

    setDraft(merged);
    setSaveMessage(`Linked ${added} breakdown items from screenplay`);
    saveMutation.mutate(merged);
  }, [
    hasProject,
    draft,
    breakdownDirty,
    projectScenesForBreakdown,
    selectedScript?.content,
    latestProjectScriptContent,
    saveMutation,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      if (!breakdownDirty || saving || !draft) return;
      event.preventDefault();
      saveMutation.mutate(draft);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [breakdownDirty, saving, draft, saveMutation]);

  if (hasProject && (isLoading || !draft)) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <Skeleton className="h-64 bg-slate-800/60" />
      </div>
    );
  }
  if (!hasProject && !draft) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <Skeleton className="h-64 bg-slate-800/60" />
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  const categoryTab = tab === "scenes" ? null : tab;
  const breakdownRowsRaw = categoryTab ? ((draft[categoryTab] as any[]) ?? []) : [];
  const breakdownRowsFiltered = breakdownRowsRaw
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) =>
      projectScenesForBreakdown.length === 0 || !activeSceneId
        ? true
        : breakdownRowMatchesScene(row as { sceneId?: string | null }, activeSceneId),
    );
  // Characters: one identity per name (same person across scenes is not another character).
  const breakdownRowsDisplayed =
    categoryTab === "characters"
      ? groupCharactersForDisplay(breakdownRowsFiltered).map((g) => ({
          row: g.row,
          idx: g.idx,
          indices: g.indices,
          sceneIds: g.sceneIds,
        }))
      : breakdownRowsFiltered.map((item) => ({
          ...item,
          indices: [item.idx],
          sceneIds: item.row.sceneId ? [item.row.sceneId] : [],
        }));

  const sceneForNewRow =
    projectScenesForBreakdown.length === 0 ? null : activeSceneId || null;
  const addRow = () => {
    if (!categoryTab) return;
    if (projectScenesForBreakdown.length > 0 && !activeSceneId) return;
    const id = undefined;
    const t = categoryTab;
    if (t === "characters") {
      // Blank row for this scene only — user types the name; we block duplicate names on save.
      setDraft({
        ...draft,
        characters: consolidateCharacterRows([
          ...(draft.characters ?? []),
          { id, name: "", sceneId: sceneForNewRow },
        ]),
      });
    } else if (t === "props") {
      setDraft({
        ...draft,
        props: [...(draft.props ?? []), { id, name: "", description: "", special: false, sceneId: sceneForNewRow }],
      });
    } else if (t === "locations") {
      setDraft({
        ...draft,
        locations: [
          ...(draft.locations ?? []),
          { id, name: "", description: "", sceneId: sceneForNewRow, locationListingId: null },
        ],
      });
    } else if (t === "wardrobe") {
      setDraft({
        ...draft,
        wardrobe: [...(draft.wardrobe ?? []), { id, description: "", character: "", sceneId: sceneForNewRow }],
      });
    } else if (t === "extras") {
      setDraft({
        ...draft,
        extras: [...(draft.extras ?? []), { id, description: "", quantity: 1, sceneId: sceneForNewRow }],
      });
    } else if (t === "vehicles") {
      setDraft({
        ...draft,
        vehicles: [...(draft.vehicles ?? []), { id, description: "", stuntRelated: false, sceneId: sceneForNewRow }],
      });
    } else if (t === "stunts") {
      setDraft({
        ...draft,
        stunts: [...(draft.stunts ?? []), { id, description: "", safetyNotes: "", sceneId: sceneForNewRow }],
      });
    } else if (t === "sfx") {
      setDraft({
        ...draft,
        sfx: [...(draft.sfx ?? []), { id, description: "", practical: false, sceneId: sceneForNewRow }],
      });
    } else if (t === "makeups") {
      setDraft({
        ...draft,
        makeups: [...(draft.makeups ?? []), { id, notes: "", character: "", sceneId: sceneForNewRow }],
      });
    }
  };

  const updateRow = (index: number, field: string, value: any, indices?: number[]) => {
    if (!categoryTab) return;
    const copy = { ...draft } as any;
    const arr = [...(copy[categoryTab] ?? [])];
    const targets =
      categoryTab === "characters" && indices && indices.length > 0 ? indices : [index];

    if (categoryTab === "characters" && (field === "name" || field === "importance" || field === "description")) {
      // Keep identity metadata in sync across every scene appearance of this person.
      const previousName = normalizeCharacterName(arr[index]?.name);
      for (let i = 0; i < arr.length; i += 1) {
        const rowName = normalizeCharacterName(arr[i]?.name);
        const isTarget = targets.includes(i) || (previousName && rowName === previousName);
        if (!isTarget) continue;
        arr[i] = { ...arr[i], [field]: value };
      }
      copy[categoryTab] = consolidateCharacterRows(arr);
    } else {
      for (const i of targets) {
        if (!arr[i]) continue;
        arr[i] = { ...arr[i], [field]: value };
      }
      copy[categoryTab] = categoryTab === "characters" ? consolidateCharacterRows(arr) : arr;
    }
    setDraft(copy);
  };

  const removeRow = (index: number, indices?: number[]) => {
    if (!draft || !categoryTab) return;
    const copy = { ...draft } as any;
    const arr = [...(copy[categoryTab] ?? [])];
    if (categoryTab === "characters") {
      const targets = new Set(indices && indices.length > 0 ? indices : [index]);
      // When viewing all scenes, removing a character removes every appearance.
      // When a scene is selected, only remove that scene's row.
      if (activeSceneId) {
        copy[categoryTab] = arr.filter((_, i) => !targets.has(i));
      } else {
        const nameKey = normalizeCharacterName(arr[index]?.name);
        copy[categoryTab] = nameKey
          ? arr.filter((row) => normalizeCharacterName(row?.name) !== nameKey)
          : arr.filter((_, i) => !targets.has(i));
      }
      copy[categoryTab] = consolidateCharacterRows(copy[categoryTab]);
    } else {
      arr.splice(index, 1);
      copy[categoryTab] = arr;
    }
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
              Professional Script Breakdown Studio — AI analyzes your screenplay, tags every production element, and
              powers scheduling, budgeting, casting, call sheets, and department workflows.
              {!hasProject && (
                <span className="block mt-2 text-amber-200/90">
                  Working without a linked project — changes save locally in this browser. Link a project above to sync to your production workspace.
                </span>
              )}
            </p>
          </div>
        <div className="flex items-center gap-2">
          <ToolViewButton
            onClick={() => setBreakdownViewOpen(true)}
            count={
              uniqueCharacterCount(draft.characters) +
              (draft.props?.length ?? 0) +
              (draft.locations?.length ?? 0) +
              projectScenesForBreakdown.length
            }
          />
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
          {saveMessage ? <p className="text-[11px] text-slate-400">{saveMessage}</p> : null}
        </div>
        </div>
      </header>

      <ToolSavedViewSheet
        open={breakdownViewOpen}
        onClose={() => setBreakdownViewOpen(false)}
        title="Saved breakdown"
        subtitle="Summary of tagged elements and synced scenes."
      >
        <BreakdownSavedViewer
          summary={{
            characters: uniqueCharacterCount(draft.characters),
            props: draft.props?.length ?? 0,
            locations: draft.locations?.length ?? 0,
            wardrobe: draft.wardrobe?.length ?? 0,
            extras: draft.extras?.length ?? 0,
            vehicles: draft.vehicles?.length ?? 0,
            stunts: draft.stunts?.length ?? 0,
            sfx: draft.sfx?.length ?? 0,
            makeups: draft.makeups?.length ?? 0,
            scenes: projectScenesForBreakdown.length,
          }}
          scenes={projectScenesForBreakdown.map((s) => ({
            number: s.number,
            heading: s.heading,
            summary: s.summary,
          }))}
        />
      </ToolSavedViewSheet>

      <BreakdownStudioShell
        studioTab={studioTab}
        onStudioTabChange={setStudioTab}
        intelligence={intelligence}
        intelligenceLoading={hasProject && intelligenceLoading}
        projectId={projectId}
        selectedSceneId={activeSceneId || null}
        onSelectScene={(id) => setActiveSceneId(id)}
        onEditScene={(id, mode) => openBreakdownEditor(id, mode)}
        selectedAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
        onCloseAsset={() => setSelectedAsset(null)}
        activeDepartment={activeDepartment}
        onActiveDepartment={setActiveDepartment}
        highlightCategory={highlightCategory}
        onHighlightCategory={(cat) => {
          setHighlightCategory(cat);
          if (cat) setTab(cat);
        }}
        onRunAi={() => {
          if (
            !window.confirm(
              "AI will replace all breakdown rows and refresh scene intelligence. Continue?",
            )
          ) {
            return;
          }
          setAiPopulateMessage("");
          autoPopulateMutation.mutate({ mode: "full" });
        }}
        aiRunning={autoPopulateMutation.isPending}
        screenplayContent={latestProjectScriptContent || selectedScript?.content || ""}
        breakdownDraft={draft}
        revisionImpact={revisionImpact}
        revisionLoading={revisionLoading}
        departmentWorkspace={departmentWorkspace}
        departmentWorkspaceLoading={departmentWsLoading}
        editor={
          <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
        {projectScenesForBreakdown.length > 0 ? (
          <select
            value={activeSceneId}
            onChange={(e) => setActiveSceneId(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white outline-none focus:border-orange-500 min-w-[200px]"
          >
            {projectScenesForBreakdown.map((s) => (
              <option key={s.id} value={s.id}>
                Sc. {s.number}
                {s.heading ? ` — ${s.heading.slice(0, 36)}${s.heading.length > 36 ? "…" : ""}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-slate-500 text-[11px]">Sync scenes to start editing</span>
        )}
        {breakdownScriptOptions.length > 0 ? (
          <select
            value={breakdownScriptId || breakdownScriptOptions[0]?.id || ""}
            onChange={(e) => setBreakdownScriptId(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white outline-none focus:border-cyan-500 max-w-[220px]"
            title="Script used for AI breakdown"
          >
            {breakdownScriptOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          <Button
            type="button"
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] h-7"
            disabled={syncScenesMutation.isPending}
            onClick={() => {
              setSceneSyncMessage("");
              syncScenesMutation.mutate();
            }}
          >
            {syncScenesMutation.isPending ? "Syncing…" : "Sync scenes"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] h-7 disabled:opacity-40"
            disabled={!latestProjectScriptContent.trim() || autoPopulateMutation.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  "AI will replace all breakdown rows for this project. Continue?",
                )
              ) {
                return;
              }
              setAiPopulateMessage("");
              autoPopulateMutation.mutate({ mode: "full" });
            }}
          >
            {autoPopulateMutation.isPending ? "AI…" : "AI breakdown"}
          </Button>
        </div>
      </div>
      {sceneSyncMessage ? <p className="text-[11px] text-slate-400">{sceneSyncMessage}</p> : null}
      {aiPopulateMessage ? (
        <p
          className={`text-[11px] ${
            /\b(fail|error|could not)\b/i.test(aiPopulateMessage) ? "text-amber-200/90" : "text-emerald-200/90"
          }`}
        >
          {aiPopulateMessage}
        </p>
      ) : null}

      {hasProject && projectId ? (
        <ModocBreakdownIncorporateBar projectId={projectId} sceneId={activeSceneId || null} />
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setTab("scenes")}
          className={`px-3 py-1.5 rounded-lg border text-[11px] ${
            tab === "scenes"
              ? "bg-orange-500 border-orange-500 text-white"
              : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          Scene details
        </button>
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
            "makeups",
          ] as BreakdownCategoryTab[]
        ).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] ${
              tab === key
                ? "bg-orange-500 border-orange-500 text-white"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {key === "sfx" ? "SFX" : key === "makeups" ? "Makeup" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <div className="creator-glass-panel p-3 space-y-3">
          {tab === "scenes" ? (
            (() => {
              const s = projectScenesForBreakdown.find((sc) => sc.id === activeSceneId);
              if (!s) {
                return (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    Select a scene above or sync from your screenplay in Script Writing.
                  </p>
                );
              }
              const ch = (draft.characters ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const pr = (draft.props ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const loc = (draft.locations ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const wd = (draft.wardrobe ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const ex = (draft.extras ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const vh = (draft.vehicles ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const st = (draft.stunts ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const fx = (draft.sfx ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const mu = (draft.makeups ?? []).filter((r) => breakdownRowMatchesScene(r, s.id));
              const line = (label: string, text: string) => (
                <li>
                  <span className="text-slate-500">{label}</span> {text || "—"}
                </li>
              );
              const slugGuess = parseSluglineMeta(s.heading);
              return (
                <div className="space-y-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-white">Scene {s.number}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5 break-words">{s.heading || "—"}</p>
                    </div>
                    {!editingSceneMeta ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] h-7"
                        onClick={() => setEditingSceneMeta(true)}
                      >
                        Manual edit
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 text-[10px] h-7"
                        onClick={() => setEditingSceneMeta(false)}
                      >
                        Done editing
                      </Button>
                    )}
                  </div>

                  {!editingSceneMeta ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-[11px]">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5">
                          <p className="text-[10px] text-slate-500">Story day</p>
                          <p className="text-slate-200">{getSceneField(s, "storyDay") || "—"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5">
                          <p className="text-[10px] text-slate-500">INT / EXT</p>
                          <p className="text-slate-200">{getSceneField(s, "intExt") || slugGuess.intExt || "—"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5">
                          <p className="text-[10px] text-slate-500">Time of day</p>
                          <p className="text-slate-200">{getSceneField(s, "timeOfDay") || slugGuess.timeOfDay || "—"}</p>
                        </div>
                      </div>
                      {getSceneField(s, "summary") ? (
                        <div>
                          <p className="text-[10px] uppercase text-slate-500 mb-1">Description</p>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap">{getSceneField(s, "summary")}</p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-slate-500">Story day</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="e.g. 1"
                            value={getSceneField(s, "storyDay")}
                            onChange={(e) => setSceneField(s.id, "storyDay", e.target.value)}
                            className="bg-slate-950 border-slate-700 text-[11px] h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-slate-500">INT / EXT</label>
                          <select
                            value={getSceneField(s, "intExt")}
                            onChange={(e) => setSceneField(s.id, "intExt", e.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white outline-none focus:border-orange-500 h-8"
                          >
                            <option value="">—</option>
                            <option value="INT">INT</option>
                            <option value="EXT">EXT</option>
                            <option value="INT_EXT">INT./EXT.</option>
                            <option value="UNKNOWN">Unknown</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wide text-slate-500">Time of day</label>
                          <select
                            value={getSceneField(s, "timeOfDay")}
                            onChange={(e) => setSceneField(s.id, "timeOfDay", e.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white outline-none focus:border-orange-500 h-8"
                          >
                            <option value="">—</option>
                            <option value="DAY">Day</option>
                            <option value="NIGHT">Night</option>
                            <option value="DAWN">Dawn</option>
                            <option value="DUSK">Dusk</option>
                            <option value="CONTINUOUS">Continuous</option>
                            <option value="LATER">Later</option>
                            <option value="SAME">Same</option>
                            <option value="MORNING">Morning</option>
                            <option value="AFTERNOON">Afternoon</option>
                            <option value="EVENING">Evening</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-200 hover:bg-slate-800 text-[10px] h-8"
                            disabled={!s.heading?.trim()}
                            onClick={() => {
                              const meta = parseSluglineMeta(s.heading);
                              setSceneEdits((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...prev[s.id],
                                  ...(meta.intExt ? { intExt: meta.intExt } : {}),
                                  ...(meta.timeOfDay ? { timeOfDay: meta.timeOfDay } : {}),
                                },
                              }));
                            }}
                          >
                            Fill from slugline
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] h-8"
                            disabled={
                              saveSceneDetailsMutation.isPending &&
                              saveSceneDetailsMutation.variables?.id === s.id
                            }
                            onClick={() =>
                              saveSceneDetailsMutation.mutate({
                                id: s.id,
                                storyDay: getSceneField(s, "storyDay"),
                                intExt: getSceneField(s, "intExt"),
                                timeOfDay: getSceneField(s, "timeOfDay"),
                                summary: getSceneField(s, "summary"),
                              })
                            }
                          >
                            {saveSceneDetailsMutation.isPending && saveSceneDetailsMutation.variables?.id === s.id
                              ? "Saving…"
                              : "Save scene"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wide text-slate-500">Description</label>
                        <textarea
                          value={getSceneField(s, "summary")}
                          onChange={(e) => setSceneField(s.id, "summary", e.target.value)}
                          placeholder="Short scene summary for production."
                          rows={3}
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-[11px] text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 resize-y min-h-[4.5rem]"
                        />
                      </div>
                    </>
                  )}

                  <ul className="space-y-1 text-[11px] text-slate-300 border-t border-slate-800 pt-3">
                    {line("Characters:", ch.map((c) => c.name).filter(Boolean).join(", "))}
                    {line("Props:", pr.map((p) => p.name).filter(Boolean).join(", "))}
                    {line("Locations:", loc.map((l) => l.name).filter(Boolean).join(", "))}
                    {line(
                      "Wardrobe:",
                      wd.map((w) => (w.character ? `${w.description} (${w.character})` : w.description)).join("; "),
                    )}
                    {line("Extras:", ex.map((e) => `${e.description}${e.quantity ? ` ×${e.quantity}` : ""}`).join("; "))}
                    {line("Vehicles:", vh.map((v) => v.description).filter(Boolean).join(", "))}
                    {line("Stunts:", st.map((x) => x.description).filter(Boolean).join(", "))}
                    {line("SFX:", fx.map((x) => x.description).filter(Boolean).join(", "))}
                    {line(
                      "Makeup:",
                      mu.map((m) => (m.character ? `${m.notes} (${m.character})` : m.notes)).filter(Boolean).join("; "),
                    )}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-200 text-[10px]"
                    onClick={() => openBreakdownEditor(s.id, "items")}
                  >
                    Edit breakdown items for this scene
                  </Button>
                </div>
              );
            })()
          ) : (
            <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <p className="text-xs text-slate-400">
              {breakdownRowsDisplayed.length} item{breakdownRowsDisplayed.length === 1 ? "" : "s"}
              {projectScenesForBreakdown.length > 0 && activeSceneId
                ? ` · Scene ${projectScenesForBreakdown.find((x) => x.id === activeSceneId)?.number ?? ""}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {!editingCategoryRows ? (
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] h-7"
                  onClick={() => setEditingCategoryRows(true)}
                  disabled={projectScenesForBreakdown.length > 0 && !activeSceneId}
                >
                  Manual edit
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-300 text-[10px] h-7"
                    onClick={() => setEditingCategoryRows(false)}
                  >
                    Done editing
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800 text-[10px] h-7"
                    onClick={addRow}
                    disabled={projectScenesForBreakdown.length > 0 && !activeSceneId}
                  >
                    Add row
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="max-h-[min(60vh,520px)] overflow-y-auto space-y-2 text-xs">
            {breakdownRowsDisplayed.length === 0 ? (
              <p className="text-slate-500 text-xs py-4 text-center">
                {projectScenesForBreakdown.length > 0
                  ? "No items for this scene yet."
                  : "Sync scenes from your screenplay to tag breakdown per scene."}
              </p>
            ) : !editingCategoryRows ? (
              <ul className="space-y-1.5">
                {breakdownRowsDisplayed.map(({ row, idx, sceneIds }) => {
                  let label = "";
                  if (categoryTab === "characters") {
                    const sceneCount = sceneIds?.length ?? 0;
                    label = row.name || "Unnamed character";
                    if (sceneCount > 0) {
                      label += ` · ${sceneCount} scene${sceneCount === 1 ? "" : "s"}`;
                    }
                  } else if (categoryTab === "props") label = row.name || row.description || "Prop";
                  else if (categoryTab === "locations") label = row.name || row.description || "Location";
                  else if (categoryTab === "wardrobe")
                    label = row.character ? `${row.description} (${row.character})` : row.description || "Wardrobe";
                  else if (categoryTab === "extras")
                    label = `${row.description || "Extras"}${row.quantity ? ` ×${row.quantity}` : ""}`;
                  else if (categoryTab === "vehicles") label = row.description || "Vehicle";
                  else if (categoryTab === "stunts") label = row.description || "Stunt";
                  else if (categoryTab === "sfx") label = row.description || "SFX";
                  else if (categoryTab === "makeups")
                    label = (row as { character?: string; notes?: string }).character
                      ? `${(row as { notes?: string }).notes} (${(row as { character?: string }).character})`
                      : (row as { notes?: string }).notes || "Makeup";
                  return (
                    <li
                      key={row.id ?? `row-${idx}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-200"
                    >
                      {label}
                    </li>
                  );
                })}
              </ul>
            ) : (
              breakdownRowsDisplayed.map(({ row, idx, indices }) => (
                <div
                  key={row.id ?? `row-${idx}`}
                  className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2"
                >
                {categoryTab === "characters" && (
                  <>
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(idx, "name", e.target.value, indices)}
                      placeholder="Character name"
                      className="md:col-span-3 bg-slate-950 border-slate-700 text-[11px]"
                    />
                  </>
                )}
                {categoryTab === "props" && (
                  <>
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
                {categoryTab === "locations" && (
                  <>
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
                {categoryTab === "wardrobe" && (
                  <>
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
                {categoryTab === "extras" && (
                  <>
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
                {categoryTab === "vehicles" && (
                  <>
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
                {categoryTab === "stunts" && (
                  <>
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
                {categoryTab === "sfx" && (
                  <>
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
                {categoryTab === "makeups" && (
                  <>
                    <textarea
                      value={(row as { notes?: string }).notes ?? ""}
                      onChange={(e) => updateRow(idx, "notes", e.target.value)}
                      rows={3}
                      className="md:col-span-3 w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-white outline-none"
                      placeholder="Hair, makeup, prosthetics, continuity notes — what the team needs for this scene"
                    />
                    <Input
                      value={(row as { character?: string | null }).character ?? ""}
                      onChange={(e) => updateRow(idx, "character", e.target.value)}
                      placeholder="Character (optional)"
                      className="bg-slate-950 border-slate-700 text-[11px]"
                    />
                  </>
                )}
                <div className="flex justify-end md:col-span-4 pt-0.5">
                  <button
                    type="button"
                    className="text-[10px] font-medium text-red-400 hover:text-red-300"
                    onClick={() => removeRow(idx, indices)}
                  >
                    Remove
                  </button>
                </div>
                </div>
              ))
            )}
          </div>
            </>
          )}
      </div>

          </>
        }
      />

      
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
  const [localBudgetDraft, setLocalBudgetDraft] = useState<LocalBudgetDraft | null>(null);

  useEffect(() => {
    if (!hasProject) {
      setLocalBudgetDraft(getLocalBudgetDraft());
    }
  }, [hasProject]);

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [persistedActiveBudgetId, setPersistedActiveBudgetId] = useState<string | null>(null);
  const activeBudgetHydratedRef = useRef(false);
  const [newBudgetName, setNewBudgetName] = useState("");
  const [showNewBudgetForm, setShowNewBudgetForm] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setPersistedActiveBudgetId(getActiveBudgetId(projectId));
    activeBudgetHydratedRef.current = false;
  }, [projectId]);

  const { data, isLoading, isError: budgetLoadError, error: budgetLoadErr } = useQuery({
    queryKey: ["project-budget", projectId, selectedBudgetId],
    queryFn: projectToolQueryFn(
      `/api/creator/projects/${projectId}/budget${selectedBudgetId ? `?budgetId=${selectedBudgetId}` : ""}`,
    ),
    enabled: hasProject,
  });

  const projectBudgets = (data?.budgets as Array<{
    id: string;
    name: string;
    isDefault: boolean;
    template: string;
    totalPlanned: number;
  }> | undefined) ?? [];

  useEffect(() => {
    if (!hasProject || !projectId || projectBudgets.length === 0) return;
    if (activeBudgetHydratedRef.current) return;
    activeBudgetHydratedRef.current = true;
    const stored = getActiveBudgetId(projectId);
    if (stored && projectBudgets.some((b) => b.id === stored)) {
      setSelectedBudgetId(stored);
      return;
    }
    const fallback = projectBudgets.find((b) => b.isDefault) ?? projectBudgets[0];
    if (fallback) setSelectedBudgetId(fallback.id);
  }, [hasProject, projectId, projectBudgets]);

  const { data: breakdownData } = useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/breakdown`),
    enabled: !!hasProject && !!projectId,
  });
  const { data: scenesData } = useQuery({
    queryKey: ["project-scenes", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/scenes`),
    enabled: !!hasProject && !!projectId,
  });
  const apiBudget = data?.budget as
    | {
        id: string;
        name?: string;
        isDefault?: boolean;
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
  const apiEngine = data?.engine as
    | {
        dashboard?: {
          estimatedTotal: number;
          actualSpend: number;
          variance: number;
          contingencyPercent: number;
          contingencyAllocation: number;
          costPerMinute: number;
          dailyBurnRate: number;
          shootDaysCount: number;
        };
        byDepartment?: Array<{
          department: string;
          estimated: number;
          actual: number;
          variance: number;
        }>;
        sceneLineItems?: Array<{
          key: string;
          sceneId: string;
          sceneNumber: string;
          sceneHeading: string | null;
          category: string;
          department: string;
          name: string;
          quantity: number;
          unitCost: number;
          total: number;
          notes: string;
        }>;
        optimizationSuggestions?: string[];
      }
    | undefined;

  const budget = hasProject
    ? apiBudget
    : localBudgetDraft
      ? {
          id: "local",
          template: localBudgetDraft.template,
          totalPlanned: localBudgetDraft.lines.reduce(
            (sum, line) => sum + Number(line.total ?? (line.quantity ?? 1) * (line.unitCost ?? 0)),
            0,
          ),
          lines: localBudgetDraft.lines.map((line, idx) => ({
            id: line.id ?? `local-${idx}`,
            department: line.department,
            name: line.name,
            quantity: line.quantity,
            unitCost: line.unitCost,
            total: line.total,
            notes: line.notes,
          })),
        }
      : undefined;
  const engine = hasProject ? apiEngine : localBudgetDraft?.engine;

  type BudgetScene = { id: string; number: string; heading: string | null };
  type BudgetRow = {
    id?: string;
    key: string;
    department: string;
    name: string;
    quantity: number;
    unitCost: number;
    total: number;
    notes: string;
    sceneId: string | null;
    sceneNumber: string | null;
    sceneHeading: string | null;
    category: string;
  };

  const projectScenes = ((scenesData?.scenes as BudgetScene[] | undefined) ?? []).sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }),
  );
  const sceneById = useMemo(() => new Map(projectScenes.map((s) => [s.id, s])), [projectScenes]);

  const [templateChoice, setTemplateChoice] = useState<
    | "SHORT_FILM"
    | "INDIE_FILM"
    | "FEATURE_FILM"
    | "TV_EPISODE"
    | "SERIES_PILOT"
    | "STUDENT_PRODUCTION"
    | "COMMERCIAL_SHOOT"
  >("SHORT_FILM");

  const [draftRows, setDraftRows] = useState<BudgetRow[]>([]);
  const [savedRows, setSavedRows] = useState<BudgetRow[]>([]);
  const [budgetWorkspace, setBudgetWorkspace] = useState<BudgetWorkspaceId>("overview");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [initError, setInitError] = useState("");

  function calcTotal(quantity: number, unitCost: number): number {
    return Math.max(0, quantity) * Math.max(0, unitCost);
  }

  const normalizeRows = useCallback((rows: BudgetRow[]): BudgetRow[] => {
    return rows.map((r) => ({
      ...r,
      quantity: Number.isFinite(r.quantity) ? r.quantity : 1,
      unitCost: Number.isFinite(r.unitCost) ? r.unitCost : 0,
      total: calcTotal(r.quantity, r.unitCost),
      notes: r.notes ?? "",
    }));
  }, []);

  const buildTemplateRowsFromBreakdown = useCallback((): BudgetRow[] => {
    if (!breakdownData) return [];
    const next: BudgetRow[] = [];
    const pushRow = (
      sceneId: string | null,
      category: string,
      department: string,
      name: string,
      quantity = 1,
      notes = "",
    ) => {
      const scene = sceneId ? sceneById.get(sceneId) : null;
      const sceneNumber = scene?.number ?? null;
      next.push({
        key: `${sceneId ?? "none"}|${category}|${name}`.toLowerCase(),
        department,
        name,
        quantity,
        unitCost: 0,
        total: 0,
        notes,
        sceneId,
        sceneNumber,
        sceneHeading: scene?.heading ?? null,
        category,
      });
    };

    const characters = (breakdownData.characters ?? []) as Array<{ name: string; sceneId?: string | null }>;
    const props = (breakdownData.props ?? []) as Array<{ name: string; sceneId?: string | null; special?: boolean }>;
    const locations = (breakdownData.locations ?? []) as Array<{ name: string; sceneId?: string | null }>;
    const wardrobe = (breakdownData.wardrobe ?? []) as Array<{ description: string; character?: string | null; sceneId?: string | null }>;
    const extras = (breakdownData.extras ?? []) as Array<{ description: string; quantity?: number; sceneId?: string | null }>;
    const vehicles = (breakdownData.vehicles ?? []) as Array<{ description: string; sceneId?: string | null; stuntRelated?: boolean }>;
    const stunts = (breakdownData.stunts ?? []) as Array<{ description: string; safetyNotes?: string | null; sceneId?: string | null }>;
    const sfx = (breakdownData.sfx ?? []) as Array<{ description: string; practical?: boolean; sceneId?: string | null }>;
    const makeups = ((breakdownData as { makeups?: Array<{ notes: string; character?: string | null; sceneId?: string | null }> })
      .makeups ?? []) as Array<{ notes: string; character?: string | null; sceneId?: string | null }>;

    characters.forEach((c) => pushRow(c.sceneId ?? null, "CHARACTER", "CAST", `Character: ${c.name || "Unspecified"}`, 1));
    props.forEach((p) => pushRow(p.sceneId ?? null, "PROP", "PROPS", `Prop: ${p.name || "Unspecified"}`, 1, p.special ? "Special/hero prop" : ""));
    locations.forEach((l) => pushRow(l.sceneId ?? null, "LOCATION", "LOCATIONS", `Location: ${l.name || "Unspecified"}`, 1));
    wardrobe.forEach((w) =>
      pushRow(
        w.sceneId ?? null,
        "WARDROBE",
        "WARDROBE",
        `Wardrobe: ${w.description || "Unspecified"}`,
        1,
        w.character ? `Character: ${w.character}` : "",
      ),
    );
    extras.forEach((e) => pushRow(e.sceneId ?? null, "EXTRAS", "CASTING", `Extras: ${e.description || "Unspecified"}`, e.quantity ?? 1));
    vehicles.forEach((v) =>
      pushRow(v.sceneId ?? null, "VEHICLE", "TRANSPORT", `Vehicle: ${v.description || "Unspecified"}`, 1, v.stuntRelated ? "Stunt related" : ""),
    );
    stunts.forEach((s) =>
      pushRow(s.sceneId ?? null, "STUNT", "STUNTS", `Stunt: ${s.description || "Unspecified"}`, 1, s.safetyNotes ?? ""),
    );
    sfx.forEach((fx) =>
      pushRow(
        fx.sceneId ?? null,
        "SFX",
        "SFX",
        `SFX: ${fx.description || "Unspecified"}`,
        1,
        fx.practical ? "Practical effect" : "Non-practical effect",
      ),
    );
    makeups.forEach((m) =>
      pushRow(
        m.sceneId ?? null,
        "MAKEUP",
        "HAIR_MAKEUP",
        `Makeup: ${m.notes || "Unspecified"}`,
        1,
        m.character ? `Character: ${m.character}` : "",
      ),
    );

    return normalizeRows(next);
  }, [breakdownData, normalizeRows, sceneById]);

  const buildTemplateRowsFromEngine = useCallback((): BudgetRow[] => {
    const items = engine?.sceneLineItems ?? [];
    if (!items.length) return [];
    return normalizeRows(
      items.map((item) => ({
        id: undefined,
        key: item.key,
        department: item.department,
        name: item.name,
        quantity: Number(item.quantity ?? 1),
        unitCost: Number(item.unitCost ?? 0),
        total: Number(item.total ?? 0),
        notes: item.notes ?? "",
        sceneId: item.sceneId ?? null,
        sceneNumber: item.sceneNumber ?? null,
        sceneHeading: item.sceneHeading ?? null,
        category: item.category ?? "ENGINE",
      })),
    );
  }, [engine?.sceneLineItems, normalizeRows]);

  const [vaBudgetPrompt, setVaBudgetPrompt] = useState<{
    budgetId: string;
    open: boolean;
  } | null>(null);
  const vaPromptDismissedRef = useRef<Set<string>>(new Set());

  const rowsFromSavedLines = useCallback(
    (lines: NonNullable<typeof budget>["lines"] | undefined): BudgetRow[] => {
      return normalizeRows(
        (lines ?? []).map((line) => {
          const qty = Number(line.quantity ?? 1);
          const unit = Number(line.unitCost ?? 0);
          const key = extractBudgetLineKey(line.notes, {
            id: line.id,
            department: line.department,
            name: line.name,
          });
          return {
            id: line.id,
            key,
            department: line.department,
            name: line.name,
            quantity: qty,
            unitCost: unit,
            total: Number(line.total ?? calcTotal(qty, unit)),
            notes: stripBudgetLineKey(line.notes) || "",
            sceneId: null,
            sceneNumber: null,
            sceneHeading: null,
            category: "MANUAL",
          };
        }),
      );
    },
    [normalizeRows],
  );

  const budgetDirty = useMemo(
    () => JSON.stringify(draftRows) !== JSON.stringify(savedRows),
    [draftRows, savedRows],
  );

  /** Empty saved lines + empty draft = blank budget; hide engine estimates until VA fills or user adds lines. */
  const isBlankBudget = useMemo(() => {
    const savedEmpty = (budget?.lines ?? []).length === 0;
    const draftEmpty = draftRows.length === 0;
    return savedEmpty && draftEmpty;
  }, [budget?.lines, draftRows]);

  const vaPromptBlocking = Boolean(
    vaBudgetPrompt?.open && vaBudgetPrompt.budgetId === budget?.id,
  );

  const showEngineEstimates = !isBlankBudget && !vaPromptBlocking;

  const handleSetAsActive = useCallback(() => {
    if (!projectId || !budget?.id) return;
    setActiveBudgetId(projectId, budget.id);
    setPersistedActiveBudgetId(budget.id);
    setSelectedBudgetId(budget.id);
    setSaveMessage(`"${budget.name ?? "Budget"}" is now your active budget for this project.`);
  }, [projectId, budget?.id, budget?.name]);

  // Load only what the creator has saved — never auto-inject VA/engine lines.
  useEffect(() => {
    if (!budget) return;

    const budgetId = budget.id;
    const isEmpty = (budget.lines ?? []).length === 0;
    if (isEmpty && !vaPromptDismissedRef.current.has(budgetId)) {
      setVaBudgetPrompt({ budgetId, open: true });
    } else if (!isEmpty) {
      setVaBudgetPrompt((prev) => (prev?.budgetId === budgetId ? null : prev));
    }

    // Keep in-progress edits (including VA-generated rows awaiting save).
    if (budgetDirty) return;

    const finalRows = rowsFromSavedLines(budget.lines);
    setDraftRows(finalRows);
    setSavedRows(JSON.parse(JSON.stringify(finalRows)));
  }, [budget, rowsFromSavedLines, budgetDirty]);

  const applyVaGeneratedRows = useCallback(() => {
    const engineRows = buildTemplateRowsFromEngine();
    const template = engineRows.length > 0 ? engineRows : buildTemplateRowsFromBreakdown();
    const finalRows = mergeBudgetTemplateWithSaved(template, budget?.lines ?? []);
    setDraftRows(finalRows);
    return finalRows;
  }, [buildTemplateRowsFromEngine, buildTemplateRowsFromBreakdown, budget?.lines]);

  const dismissVaBudgetPrompt = useCallback(
    (budgetId: string) => {
      vaPromptDismissedRef.current.add(budgetId);
      setVaBudgetPrompt(null);
    },
    [],
  );

  const handleVaBudgetNo = useCallback(() => {
    if (!vaBudgetPrompt) return;
    dismissVaBudgetPrompt(vaBudgetPrompt.budgetId);
    setDraftRows([]);
    setSavedRows([]);
    setSaveMessage("Starting from a blank budget — add your own line items.");
  }, [vaBudgetPrompt, dismissVaBudgetPrompt]);

  const handleVaBudgetYes = useCallback(() => {
    if (!vaBudgetPrompt) return;
    const budgetId = vaBudgetPrompt.budgetId;
    dismissVaBudgetPrompt(budgetId);
    const rows = applyVaGeneratedRows();
    if (rows.length === 0) {
      setSaveMessage("No script/breakdown data to generate from yet — add lines manually.");
      return;
    }
    setSaveMessage(`VA added ${rows.length} line items — review and save when ready.`);
  }, [vaBudgetPrompt, dismissVaBudgetPrompt, applyVaGeneratedRows]);

  const initMutation = useMutation({
    mutationFn: async () => {
      if (!hasProject) {
        const draft = saveLocalBudgetDraft({
          template: templateChoice,
          lines: [],
          engine: buildStandaloneBudgetStarter(templateChoice),
        });
        setLocalBudgetDraft(draft);
        return { budget: { id: "local", template: templateChoice, totalPlanned: 0, lines: [] as NonNullable<typeof budget>["lines"] } };
      }
      return projectToolFetch<{ budget: NonNullable<typeof budget> }>(
        `/api/creator/projects/${projectId}/budget`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: templateChoice,
            name: newBudgetName.trim() || undefined,
            createNew: projectBudgets.length > 0,
          }),
        },
      );
    },
    onMutate: () => setInitError(""),
    onSuccess: (result) => {
      const budgetId = result.budget.id;
      vaPromptDismissedRef.current.delete(budgetId);
      setDraftRows([]);
      setSavedRows([]);
      setVaBudgetPrompt({ budgetId, open: true });
      if (hasProject) {
        setActiveBudgetId(projectId, budgetId);
        setPersistedActiveBudgetId(budgetId);
        setSelectedBudgetId(budgetId);
        setShowNewBudgetForm(false);
        setNewBudgetName("");
        queryClient.setQueryData(["project-budget", projectId, budgetId], (prev: typeof data) => ({
          ...(prev ?? {}),
          budget: result.budget,
        }));
        void queryClient.invalidateQueries({ queryKey: ["project-budget", projectId] });
      } else {
        setLocalBudgetDraft(
          saveLocalBudgetDraft({
            template: templateChoice,
            lines: [],
            engine: buildStandaloneBudgetStarter(templateChoice),
          }),
        );
      }
    },
    onError: (err) => {
      setInitError(mutationErrorMessage(err, "Could not create budget. Try again."));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (rows: BudgetRow[]) => {
      const lines = rows.map((r) => {
        const key = budgetRowKey(r);
        return {
          id: r.id,
          department: r.department,
          name: r.name,
          quantity: r.quantity,
          unitCost: r.unitCost,
          total: r.total,
          notes: embedBudgetLineKey(r.notes, key) || null,
        };
      });
      if (!hasProject) {
        const draft = saveLocalBudgetDraft({
          template: (localBudgetDraft?.template ?? templateChoice) as LocalBudgetDraft["template"],
          lines: lines.map(({ id, ...rest }) => rest),
          engine: localBudgetDraft?.engine ?? buildStandaloneBudgetStarter(templateChoice),
        });
        setLocalBudgetDraft(draft);
        return { budget: { id: "local", template: draft.template, totalPlanned: 0, lines } };
      }
      return projectToolFetch<{ budget: NonNullable<typeof budget> }>(
        `/api/creator/projects/${projectId}/budget`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budgetId: budget?.id, lines }),
        },
      );
    },
    onSuccess: (_d, rows) => {
      setSavedRows(JSON.parse(JSON.stringify(rows)));
      setSaveMessage("Budget saved");
      setSaveError("");
    },
    onError: (err) => {
      setSaveError(mutationErrorMessage(err, "Could not save budget. Try again."));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project-budget", projectId] });
    },
  });

  const addLine = (line: Omit<BudgetRow, "key" | "total">) => {
    setDraftRows([
      ...draftRows,
      {
        ...line,
        key: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        total: calcTotal(line.quantity, line.unitCost),
      },
    ]);
  };

  const removeLine = (index: number) => {
    setDraftRows(draftRows.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof BudgetRow, value: string | number) => {
    const copy = [...draftRows];
    const line = { ...copy[index] };
    (line as unknown as Record<string, unknown>)[field] = value;
    const qty = Number(line.quantity ?? 1);
    const unit = Number(line.unitCost ?? 0);
    line.total = calcTotal(qty, unit);
    copy[index] = line;
    setDraftRows(copy);
  };

  const total = useMemo(
    () => draftRows.reduce((sum: number, l) => sum + (l.total ?? 0), 0),
    [draftRows]
  );

  const setDefaultBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) =>
      projectToolFetch(`/api/creator/projects/${projectId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetId, setDefault: true }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-budget", projectId] });
    },
  });

  const [budgetViewOpen, setBudgetViewOpen] = useState(false);

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6 space-y-5">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
            Pre-production workspace
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
            Build and edit production budgets for this project. Create multiple versions (e.g. lean vs full), add your own line items, and ask the Virtual Assistant to generate or optimise a budget from your script.
          </p>
          {hasProject && projectId && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <Link
                href={`/creator/projects/${projectId}/production/expense-tracker`}
                className="text-orange-400 hover:text-orange-300"
              >
                Expense tracker →
              </Link>
              <Link
                href={`/creator/projects/${projectId}/pre-production/production-scheduling`}
                className="text-orange-400 hover:text-orange-300"
              >
                Production schedule →
              </Link>
            </div>
          )}
        </div>

        {budget ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2 min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Active budget</p>
                <div className="flex flex-wrap items-center gap-2">
                  {hasProject && projectBudgets.length > 0 ? (
                    <select
                      value={selectedBudgetId ?? budget?.id ?? ""}
                      onChange={(e) => setSelectedBudgetId(e.target.value || null)}
                      className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white min-w-[200px] max-w-full"
                    >
                      {projectBudgets.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                          {b.id === persistedActiveBudgetId ? " (active)" : ""}
                          {b.isDefault ? " (VA default)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-200 font-medium">{budget.name ?? "Budget"}</span>
                  )}
                  {hasProject && budget && budget.id !== persistedActiveBudgetId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-orange-500/40 text-[11px] text-orange-200 h-8 hover:bg-orange-500/10"
                      onClick={handleSetAsActive}
                    >
                      Set as active
                    </Button>
                  )}
                  {budget && !budget.isDefault && hasProject && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-[11px] text-slate-400 h-8"
                      disabled={setDefaultBudgetMutation.isPending}
                      onClick={() => setDefaultBudgetMutation.mutate(budget.id)}
                    >
                      Set as VA default
                    </Button>
                  )}
                  {hasProject && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-[11px] h-8"
                      onClick={() => setShowNewBudgetForm((v) => !v)}
                    >
                      {showNewBudgetForm ? "Cancel new budget" : "New budget"}
                    </Button>
                  )}
                </div>
                {showNewBudgetForm && hasProject ? (
                  <div className="flex flex-wrap items-end gap-2 pt-1">
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-500">Name</span>
                      <Input
                        value={newBudgetName}
                        onChange={(e) => setNewBudgetName(e.target.value)}
                        placeholder="e.g. Lean version"
                        className="h-9 w-44 bg-slate-900 border-slate-700 text-xs"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-500">Template</span>
                      <select
                        value={templateChoice}
                        onChange={(e) =>
                          setTemplateChoice(e.target.value as typeof templateChoice)
                        }
                        className="h-9 rounded-lg bg-slate-900 border border-slate-700 px-3 text-xs text-white"
                      >
                        <option value="SHORT_FILM">Short film</option>
                        <option value="INDIE_FILM">Indie film</option>
                        <option value="FEATURE_FILM">Feature film</option>
                        <option value="TV_EPISODE">TV episode</option>
                        <option value="SERIES_PILOT">Series pilot</option>
                        <option value="STUDENT_PRODUCTION">Student production</option>
                        <option value="COMMERCIAL_SHOOT">Commercial</option>
                      </select>
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-9"
                      onClick={() => initMutation.mutate()}
                      disabled={initMutation.isPending}
                    >
                      {initMutation.isPending ? "Creating…" : "Create budget"}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
                <ToolViewButton
                  onClick={() => setBudgetViewOpen(true)}
                  count={budget?.lines?.length ?? 0}
                  disabled={!budget?.lines?.length}
                />
                <span className="text-[11px] text-slate-400 px-1">
                  {saveMutation.isPending ? "Saving…" : budgetDirty ? "Unsaved changes" : "Saved"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-[11px] h-8"
                  disabled={!budgetDirty || saveMutation.isPending}
                  onClick={() => setDraftRows(JSON.parse(JSON.stringify(savedRows)))}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white text-[11px] h-8"
                  disabled={!budgetDirty || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(draftRows)}
                >
                  Save budget
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-4">
            <p className="text-xs text-slate-400 mb-3">
              Choose a template to start your first budget{hasProject ? " for this project" : " (saved locally until you link a project)"}.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              {showNewBudgetForm && hasProject ? (
                <Input
                  value={newBudgetName}
                  onChange={(e) => setNewBudgetName(e.target.value)}
                  placeholder="Budget name (optional)"
                  className="h-9 w-44 bg-slate-900 border-slate-700 text-xs"
                />
              ) : null}
              <select
                value={templateChoice}
                onChange={(e) =>
                  setTemplateChoice(e.target.value as typeof templateChoice)
                }
                className="h-9 rounded-lg bg-slate-900 border border-slate-700 px-3 text-xs text-white"
              >
                <option value="SHORT_FILM">Short film</option>
                <option value="INDIE_FILM">Indie film</option>
                <option value="FEATURE_FILM">Feature film</option>
                <option value="TV_EPISODE">TV episode</option>
                <option value="SERIES_PILOT">Series pilot</option>
                <option value="STUDENT_PRODUCTION">Student production</option>
                <option value="COMMERCIAL_SHOOT">Commercial shoot</option>
              </select>
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-9"
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
              >
                {initMutation.isPending ? "Creating…" : hasProject && projectBudgets.length > 0 ? "Create another" : "Create budget"}
              </Button>
            </div>
          </div>
        )}
      </header>

      <ToolSavedViewSheet
        open={budgetViewOpen}
        onClose={() => setBudgetViewOpen(false)}
        title="Saved budget"
        subtitle="Read-only snapshot of planned lines and department totals."
      >
        <BudgetSavedViewer
          template={budget?.template}
          totalPlanned={
            showEngineEstimates
              ? (budget?.totalPlanned ?? engine?.dashboard?.estimatedTotal ?? total)
              : total
          }
          lines={(budget?.lines ?? []).map((l) => ({
            department: l.department,
            name: l.name,
            quantity: l.quantity,
            unitCost: l.unitCost,
            total: l.total,
          }))}
          byDepartment={
            showEngineEstimates
              ? engine?.byDepartment?.map((d) => ({
                  department: d.department,
                  estimated: d.estimated,
                }))
              : undefined
          }
        />
      </ToolSavedViewSheet>

      <ToolActionError message={initError} onDismiss={() => setInitError("")} />

      {budget && vaBudgetPrompt?.open && vaBudgetPrompt.budgetId === budget.id ? (
        <div
          role="dialog"
          aria-labelledby="va-budget-prompt-title"
          aria-describedby="va-budget-prompt-desc"
          className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/15 via-slate-950 to-slate-950 p-4 shadow-lg shadow-orange-950/30"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <p
                id="va-budget-prompt-title"
                className="text-sm font-semibold text-orange-100"
              >
                Let the Virtual Assistant build this budget?
              </p>
              <p id="va-budget-prompt-desc" className="text-xs leading-relaxed text-slate-300">
                The VA can pre-fill line items from your script, scenes, and breakdown.
                Choose <span className="text-white font-medium">No</span> to start from a blank
                budget and enter everything yourself.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 bg-slate-950/60 text-slate-100 hover:bg-slate-800 h-9 px-4"
                onClick={handleVaBudgetNo}
              >
                No, start blank
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white h-9 px-4"
                onClick={handleVaBudgetYes}
              >
                Yes, VA build it
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {budget &&
      !vaBudgetPrompt?.open &&
      draftRows.length === 0 &&
      (budget.lines ?? []).length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
          <p className="text-[11px] text-slate-400">
            Blank budget — add lines manually, or let the VA fill from your script.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-orange-500/40 text-orange-200 hover:bg-orange-500/10 text-[11px] h-7"
            onClick={() => {
              if (!budget) return;
              vaPromptDismissedRef.current.delete(budget.id);
              setVaBudgetPrompt({ budgetId: budget.id, open: true });
            }}
          >
            Ask VA to build
          </Button>
        </div>
      ) : null}

      {budgetLoadError ? (
        <ToolActionError
          message={mutationErrorMessage(budgetLoadErr, "Could not load budget.")}
        />
      ) : null}
      <ToolActionError message={saveError} onDismiss={() => setSaveError("")} />

      

      {hasProject && isLoading ? (
        <Skeleton className="h-64 bg-slate-800/60" />
      ) : !budget ? null : (
        <div className="space-y-3">
          <BudgetStudioNav active={budgetWorkspace} onChange={setBudgetWorkspace} />
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-100/90">
            Ask the Story Time VA: &quot;How can I reduce this budget by R500,000?&quot; or &quot;What are my biggest costs?&quot; — it uses your <strong className="font-medium">VA default</strong> budget and live project data.
          </div>
          {budgetWorkspace === "actuals" && projectId && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <BudgetActualsPanel projectId={projectId} />
            </div>
          )}
          {budgetWorkspace === "overview" && isBlankBudget && (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
              <p className="text-sm text-slate-300">This budget has no line items yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Use the prompt above to let the VA build from your script, or add lines manually in the Budget lines tab.
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-500">{formatZar(0)}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-600">Estimated total</p>
            </div>
          )}
          {budgetWorkspace === "overview" && showEngineEstimates && engine?.dashboard && (
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Estimated budget</p>
                <p className="text-sm font-semibold text-emerald-300">
                  {formatZar(engine.dashboard.estimatedTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Actual spend</p>
                <p className="text-sm font-semibold text-white">
                  {formatZar(engine.dashboard.actualSpend)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Variance</p>
                <p
                  className={`text-sm font-semibold ${
                    engine.dashboard.variance < 0 ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {formatZar(engine.dashboard.variance)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Contingency</p>
                <p className="text-sm font-semibold text-slate-100">
                  {formatZar(engine.dashboard.contingencyAllocation)} (
                  {(engine.dashboard.contingencyPercent * 100).toFixed(0)}%)
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Cost per minute</p>
                <p className="text-sm font-semibold text-slate-100">
                  {formatZar(engine.dashboard.costPerMinute)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] text-slate-400">Daily burn rate</p>
                <p className="text-sm font-semibold text-slate-100">
                  {formatZar(engine.dashboard.dailyBurnRate)}
                </p>
              </div>
            </div>
          )}
          {budgetWorkspace === "overview" && showEngineEstimates && !!engine?.byDepartment?.length && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Cost breakdown
              </p>
              <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                {engine.byDepartment.map((dept) => (
                  <div
                    key={dept.department}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[11px]"
                  >
                    <span className="text-slate-300">{friendlyDepartmentName(dept.department)}</span>
                    <span className="text-slate-100">
                      Est {formatZar(dept.estimated, { maximumFractionDigits: 0 })} · Spent {formatZar(dept.actual, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {budgetWorkspace === "overview" && showEngineEstimates && !!engine?.optimizationSuggestions?.length && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200">Optimization insights</p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-200">
                {engine.optimizationSuggestions.map((suggestion, idx) => (
                  <li key={`${idx}-${suggestion.slice(0, 16)}`}>- {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              {budget.name ? (
                <>
                  Budget: <span className="font-medium text-slate-100">{budget.name}</span>
                  {" · "}
                </>
              ) : null}
              Template:{" "}
              <span className="font-medium text-slate-100">{budget.template.replaceAll("_", " ")}</span>
            </span>
            <span className="font-semibold text-emerald-400">
              Total planned: {formatZar(total)}
            </span>
          </div>
          {budgetWorkspace === "line-items" ? (
            <>
              <BudgetLinesEditor
                rows={draftRows}
                scenes={projectScenes}
                onUpdateLine={updateLine}
                onRemoveLine={removeLine}
                onAddLine={addLine}
              />
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                {saveMessage ? <span className="text-[11px] text-emerald-400/90">{saveMessage}</span> : <span />}
                <span className="text-[11px]">Save your budget to sync with the Expense Tracker.</span>
              </div>
            </>
          ) : null}
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
  breakdownMakeups: { id: string; notes: string; character: string | null }[];
};

type ScheduleResponse = {
  script: { id: string; title: string; sceneCount: number } | null;
  shootDays: {
    id: string;
    shootDayNumber?: number;
    date: string;
    unit: string | null;
    callTime: string | null;
    wrapTime: string | null;
    status: string;
    locationSummary: string | null;
    scenesBeingShot: string | null;
    dayNotes: string | null;
    weather?: string | null;
    transportDetails?: string | null;
    pickupDropoffInfo?: string | null;
    accommodation?: string | null;
    cateringNotes?: string | null;
    callSheetNotes?: string | null;
    scenes: {
      id: string;
      order: number;
      sceneId: string;
      scene: ScheduleSceneDetail | null;
    }[];
  }[];
  scenes: ScheduleSceneDetail[];
  crewNeeds?: { role: string; department: string }[];
  equipmentItems?: { category: string; description?: string | null; quantity: number }[];
  productionDays?: {
    id: string;
    shootDayNumber: number;
    date: string;
    callTime: string | null;
    wrapTime: string | null;
    location: string | null;
    weather: string | null;
    notes: string | null;
    logistics: {
      transportDetails: string | null;
      pickupDropoffInfo: string | null;
      accommodation: string | null;
      cateringNotes: string | null;
    };
    scenes: {
      sceneId: string;
      order: number;
      number: string;
      heading: string | null;
      description: string | null;
      estimatedShootDurationMinutes: number;
    }[];
    castRequired: {
      key: string;
      name: string;
      roleOrCharacter: string;
      callTime: string | null;
      wrapTime: string | null;
      contactInfo: string | null;
    }[];
    crewRequired: {
      key: string;
      name: string;
      role: string;
      department: string;
      callTime: string | null;
      wrapTime: string | null;
    }[];
    equipmentRequired: {
      key: string;
      equipmentName: string;
      category: string;
      quantity: number;
    }[];
  }[];
  conflicts?: {
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    message: string;
    dayIds: string[];
  }[];
  castingRoles?: {
    id: string;
    name: string;
    status?: string | null;
    breakdownCharacterId?: string | null;
    actorName?: string | null;
  }[];
  contractGate?: {
    totalContracts: number;
    signedContracts: number;
    unsignedContracts: number;
    blocking: boolean;
    unsignedDetails: {
      id: string;
      type: string;
      status: string;
      subject: string | null;
      party: string | null;
    }[];
  };
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
        makeups: [] as { key: string; text: string; character: string | null; sceneNums: string[] }[],
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
    const makeupM = new Map<string, { text: string; character: string | null; scenes: Set<string> }>();

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
      for (const mu of sc.breakdownMakeups ?? []) {
        const key = `mu:${mu.id}`;
        const prev = makeupM.get(key);
        if (!prev) {
          makeupM.set(key, {
            text: mu.notes,
            character: mu.character,
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
      makeups: [...makeupM.entries()].map(([key, v]) => ({
        key,
        text: v.text,
        character: v.character,
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
    queryFn: projectToolQueryFn<ScheduleResponse>(`/api/creator/projects/${projectId}/schedule`),
    enabled: hasProject,
  });
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [draftDays, setDraftDays] = useState<ScheduleResponse["shootDays"] | null>(null);
  const [savedSchedule, setSavedSchedule] = useState<ScheduleResponse["shootDays"] | null>(null);
  const [expandedSceneRowId, setExpandedSceneRowId] = useState<string | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scenePickerIds, setScenePickerIds] = useState<string[]>([]);
  /** Day id currently reflected in scenePickerIds. Prevents draft↔picker feedback loops. */
  const pickerDayIdRef = useRef<string | null>(null);
  /** Skip one picker→draft sync after hydrate so we don't wipe scenes with a stale empty picker. */
  const suppressPickerSyncRef = useRef(false);
  const allScenesSortedRef = useRef<ScheduleSceneDetail[]>([]);

  const applySchedulePayload = useCallback(
    (payload: ScheduleResponse, selectDayId?: string | null) => {
      const copy = JSON.parse(JSON.stringify(payload.shootDays)) as ScheduleResponse["shootDays"];
      setDraftDays(copy);
      setSavedSchedule(JSON.parse(JSON.stringify(payload.shootDays)) as ScheduleResponse["shootDays"]);
      queryClient.setQueryData(["project-schedule", projectId], payload);
      // Force picker re-hydrate from the applied payload (not from a prior draft edit).
      pickerDayIdRef.current = null;
      if (selectDayId !== undefined) {
        setSelectedDayId(selectDayId);
      } else {
        setSelectedDayId((prev) => {
          if (prev && copy.some((d) => d.id === prev)) return prev;
          return copy[copy.length - 1]?.id ?? copy[0]?.id ?? null;
        });
      }
    },
    [projectId, queryClient],
  );

  const scheduleDirty =
    !!draftDays &&
    !!savedSchedule &&
    scheduleFingerprint(draftDays) !== scheduleFingerprint(savedSchedule);

  // Keep local schedule draft in sync with server unless the user has unsaved edits.
  useEffect(() => {
    if (!data) return;
    if (scheduleDirty) return;
    const copy = JSON.parse(JSON.stringify(data.shootDays)) as ScheduleResponse["shootDays"];
    setDraftDays(copy);
    setSavedSchedule(JSON.parse(JSON.stringify(data.shootDays)) as ScheduleResponse["shootDays"]);
    // Re-hydrate picker from server snapshot only when we are not mid-edit.
    pickerDayIdRef.current = null;
    setSelectedDayId((prev) => {
      if (prev && copy.some((d) => d.id === prev)) return prev;
      return copy[0]?.id ?? null;
    });
  }, [data, scheduleDirty]);

  const selectedDay =
    draftDays?.find((d) => d.id === selectedDayId) ?? draftDays?.[0] ?? null;
  const selectedProductionDay =
    (data?.productionDays ?? []).find((d) => d.id === selectedDay?.id) ?? null;
  const selectedDayConflicts = (data?.conflicts ?? []).filter((c) =>
    selectedDay ? c.dayIds.includes(selectedDay.id) : false,
  );

  const [scheduleStripView, setScheduleStripView] = useState(false);
  const [scheduleViewOpen, setScheduleViewOpen] = useState(false);

  const createDayMutation = useMutation({
    mutationFn: async () => {
      const today = new Date();
      return projectToolFetch<ScheduleResponse>(`/api/creator/projects/${projectId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today.toISOString() }),
      });
    },
    onMutate: () => setScheduleMessage(""),
    onSuccess: (payload) => {
      const newestId = payload.shootDays[payload.shootDays.length - 1]?.id ?? null;
      applySchedulePayload(payload, newestId);
      setScheduleMessage("Shoot day added.");
      invalidateProjectPipeline(queryClient, projectId, ["scheduleDownstream"]);
    },
    onError: (err) => {
      setScheduleMessage(mutationErrorMessage(err, "Could not create shoot day. Try again."));
    },
  });

  const duplicateDayMutation = useMutation({
    mutationFn: async (sourceDayId: string) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return projectToolFetch<ScheduleResponse>(`/api/creator/projects/${projectId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duplicateFromDayId: sourceDayId,
          date: tomorrow.toISOString(),
        }),
      });
    },
    onSuccess: (fresh) => {
      const newestId = fresh.shootDays[fresh.shootDays.length - 1]?.id ?? null;
      applySchedulePayload(fresh, newestId);
      setScheduleMessage("Shoot day duplicated.");
      invalidateProjectPipeline(queryClient, projectId, ["scheduleDownstream"]);
    },
    onError: (err) => {
      setScheduleMessage(mutationErrorMessage(err, "Could not duplicate shoot day."));
    },
  });

  const scheduleSaveBlocked = Boolean(data?.contractGate?.blocking);

  const buildDaysSavePayload = (days: NonNullable<typeof draftDays>) =>
    days.map((d) => ({
      id: d.id,
      date: d.date,
      unit: d.unit,
      callTime: d.callTime,
      wrapTime: d.wrapTime,
      locationSummary: d.locationSummary,
      status: d.status,
      scenesBeingShot: d.scenesBeingShot ?? null,
      dayNotes: d.dayNotes ?? null,
      weather: d.weather ?? null,
      transportDetails: d.transportDetails ?? null,
      pickupDropoffInfo: d.pickupDropoffInfo ?? null,
      accommodation: d.accommodation ?? null,
      cateringNotes: d.cateringNotes ?? null,
      callSheetNotes: d.callSheetNotes ?? null,
      scenes: d.scenes.map((s) => ({
        sceneId: s.scene?.id ?? s.sceneId,
        order: s.order,
      })),
    }));

  const saveMutation = useMutation({
    mutationFn: async (payload: { days: any[] }) => {
      return projectToolFetch<ScheduleResponse>(`/api/creator/projects/${projectId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (fresh) => {
      applySchedulePayload(fresh, selectedDayId);
      setScheduleMessage("Schedule saved.");
      invalidateProjectPipeline(queryClient, projectId, ["scheduleDownstream"]);
    },
    onError: (error) => {
      setScheduleMessage((error as Error).message);
    },
  });
  const deleteDayMutation = useMutation({
    mutationFn: async (dayId: string) => {
      return projectToolFetch<ScheduleResponse>(
        `/api/creator/projects/${projectId}/schedule?dayId=${encodeURIComponent(dayId)}`,
        { method: "DELETE" },
      );
    },
    onSuccess: (fresh) => {
      applySchedulePayload(fresh, fresh.shootDays[0]?.id ?? null);
      setExpandedSceneRowId(null);
      setScheduleMessage("Shoot day deleted.");
      invalidateProjectPipeline(queryClient, projectId, ["scheduleDownstream"]);
    },
    onError: (err) => {
      setScheduleMessage(mutationErrorMessage(err, "Could not delete shoot day."));
    },
  });


  const persistSchedule = () => {
    if (!draftDays) return;
    if (scheduleSaveBlocked) {
      setScheduleMessage(
        "Schedule save is blocked until all project contracts are signed. Open Legal & Contracts to complete agreements.",
      );
      return;
    }
    setScheduleMessage("");
    saveMutation.mutate({
      days: buildDaysSavePayload(draftDays),
    });
  };

  const autoPopulateDayFromScene = (
    day: NonNullable<typeof draftDays>[number],
    scene: ScheduleSceneDetail,
    nextScenes: NonNullable<typeof draftDays>[number]["scenes"],
  ) => {
    const locationText = scene.primaryLocation?.name
      || scene.breakdownLocations?.[0]?.name
      || "";
    const sceneToken = `Sc. ${scene.number}${scene.heading ? ` ${scene.heading}` : ""}`;
    const nextLocationSummary = day.locationSummary?.trim()
      ? day.locationSummary
      : locationText
        ? `Primary location: ${locationText}`
        : null;
    const nextScenesBeingShot = day.scenesBeingShot?.trim()
      ? day.scenesBeingShot
      : nextScenes
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => `Sc. ${s.scene?.number ?? s.sceneId}`)
          .join(", ");
    const callHints: string[] = [];
    if ((scene.breakdownCharacters?.length ?? 0) > 0) callHints.push(`Cast: ${scene.breakdownCharacters.map((c) => c.name).join(", ")}`);
    if ((scene.breakdownProps?.length ?? 0) > 0) callHints.push(`Props: ${scene.breakdownProps.map((p) => p.name).join(", ")}`);
    if ((scene.breakdownWardrobes?.length ?? 0) > 0) callHints.push(`Wardrobe: ${scene.breakdownWardrobes.map((w) => w.description).join(", ")}`);
    const hintsText = callHints.length > 0 ? `\nAuto notes from ${sceneToken}:\n${callHints.join("\n")}` : "";
    const nextDayNotes = day.dayNotes?.trim()
      ? day.dayNotes
      : hintsText.trim() || null;
    return {
      ...day,
      locationSummary: nextLocationSummary,
      scenesBeingShot: nextScenesBeingShot || null,
      dayNotes: nextDayNotes,
    };
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
  const allScenesSorted = useMemo(
    () =>
      [...allScenes].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [allScenes],
  );
  allScenesSortedRef.current = allScenesSorted;

  const previewSceneLinks = useMemo(() => {
    if (!selectedDay) return [];
    return buildEffectiveSceneLinksForPreview({
      scenePickerIds,
      savedSceneLinks: selectedDay.scenes.map((s) => ({
        sceneId: s.scene?.id ?? s.sceneId,
        order: s.order,
        scene: s.scene,
      })),
      allScenes: allScenesSorted,
      // Once hydrated for this day, empty picker means "no scenes" — never fall back to saved.
      trustEmptyPicker: pickerDayIdRef.current === selectedDay.id,
    });
  }, [selectedDay, scenePickerIds, allScenesSorted]);

  const previewDayForAggregate = useMemo(() => {
    if (!selectedDay) return null;
    return {
      ...selectedDay,
      scenes: previewSceneLinks.map((link, index) => ({
        id: `${selectedDay.id}-${link.sceneId}`,
        sceneId: link.sceneId,
        order: index,
        scene: link.scene as ScheduleSceneDetail | null,
      })),
    };
  }, [selectedDay, previewSceneLinks]);

  const dayAggregate = useScheduleDayAggregate(previewDayForAggregate);

  const scheduleWarnings = useMemo(() => {
    if (!previewDayForAggregate) return [] as string[];
    const w: string[] = [];
    if (!previewDayForAggregate.locationSummary?.trim()) {
      w.push("This day has no location summary—add one for clearer call sheets.");
    }
    const ordered = previewDayForAggregate.scenes.slice().sort((a, b) => a.order - b.order);
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
  }, [previewDayForAggregate]);

  const pickerDiffersFromSaved = useMemo(() => {
    if (!selectedDay) return false;
    const savedIds = selectedDay.scenes
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.scene?.id ?? s.sceneId);
    if (scenePickerIds.length !== savedIds.length) return true;
    return scenePickerIds.some((id, i) => id !== savedIds[i]);
  }, [selectedDay, scenePickerIds]);

  const livePipelinePreview = useMemo(() => {
    if (!selectedDay || previewSceneLinks.length === 0) return null;
    return buildShootDayPipelinePreview({
      unit: selectedDay.unit,
      sceneLinks: previewSceneLinks,
      crewNeeds: data?.crewNeeds,
      equipmentItems: data?.equipmentItems,
      castingRoles: data?.castingRoles,
    });
  }, [selectedDay, previewSceneLinks, data]);

  const pipelineDisplay = useMemo(() => {
    if (livePipelinePreview) {
      return livePipelinePreview;
    }
    if (selectedProductionDay && !scheduleDirty) {
      return {
        unit: selectedDay?.unit ?? null,
        scenes: selectedProductionDay.scenes,
        castRequired: selectedProductionDay.castRequired,
        crewRequired: selectedProductionDay.crewRequired,
        equipmentRequired: selectedProductionDay.equipmentRequired,
      };
    }
    return null;
  }, [livePipelinePreview, selectedProductionDay, scheduleDirty, selectedDay?.unit]);

  /** Scenes assigned to other shoot days (still allow selecting them for this day). */
  const assignedToOtherDayIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of draftDays ?? []) {
      if (d.id === selectedDayId) continue;
      for (const s of d.scenes) {
        const id = s.scene?.id ?? s.sceneId;
        if (id) set.add(id);
      }
    }
    return set;
  }, [draftDays, selectedDayId]);

  // Hydrate picker only when the selected day changes (or after save/discard), never when
  // draft scenes update from the picker itself — that feedback loop cleared selections.
  useLayoutEffect(() => {
    if (!selectedDayId) {
      pickerDayIdRef.current = null;
      suppressPickerSyncRef.current = true;
      setScenePickerIds([]);
      return;
    }
    if (!draftDays) return;
    if (pickerDayIdRef.current === selectedDayId) return;
    const day = draftDays.find((d) => d.id === selectedDayId);
    if (!day) return;
    pickerDayIdRef.current = selectedDayId;
    const ids = day.scenes
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.scene?.id ?? s.sceneId)
      .filter(Boolean);
    suppressPickerSyncRef.current = true;
    setScenePickerIds(ids);
  }, [selectedDayId, draftDays]);

  // Push picker selections into the draft day. Do not re-run on draft identity changes.
  useEffect(() => {
    if (suppressPickerSyncRef.current) {
      suppressPickerSyncRef.current = false;
      return;
    }
    if (!selectedDayId || pickerDayIdRef.current !== selectedDayId) return;

    setDraftDays((prev) => {
      if (!prev) return prev;
      const day = prev.find((d) => d.id === selectedDayId);
      if (!day) return prev;

      const scenesCatalog = allScenesSortedRef.current;
      const savedIds = day.scenes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => s.scene?.id ?? s.sceneId);
      const pickerIds = scenesCatalog
        .filter((s) => scenePickerIds.includes(s.id))
        .map((s) => s.id);
      // Preserve any picker ids not yet in catalog (shouldn't happen, but avoid drops).
      for (const id of scenePickerIds) {
        if (!pickerIds.includes(id)) pickerIds.push(id);
      }
      const matches =
        pickerIds.length === savedIds.length && pickerIds.every((id, i) => id === savedIds[i]);
      if (matches) return prev;

      const sceneById = new Map(scenesCatalog.map((s) => [s.id, s]));
      const nextScenes = pickerIds.map((sceneId, index) => {
        const existing = day.scenes.find((s) => (s.scene?.id ?? s.sceneId) === sceneId);
        const scene = sceneById.get(sceneId) ?? existing?.scene ?? null;
        return {
          id: existing?.id ?? `${day.id}-${sceneId}`,
          sceneId,
          order: index,
          scene,
        };
      });
      let nextDay: (typeof prev)[number] = { ...day, scenes: nextScenes };
      const firstScene = nextScenes[0]?.scene;
      if (firstScene) {
        nextDay = autoPopulateDayFromScene(nextDay, firstScene, nextScenes);
      }
      return prev.map((d) => (d.id === day.id ? nextDay : d));
    });
  }, [scenePickerIds, selectedDayId]);

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
            Plan shoot days with Unit A/B support, scene selection, and a live output pipeline linked to breakdown and budget. Use Call Sheet Generator in Production for call sheets.
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-col gap-2 md:w-auto lg:max-w-[min(100%,36rem)] xl:max-w-none">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 lg:justify-end">
            <span className="mr-auto shrink-0 lg:mr-0">
              {saveMutation.isPending
                ? "Saving…"
                : scheduleSaveBlocked && scheduleDirty
                  ? "Save blocked (unsigned contracts)"
                  : scheduleDirty
                    ? "Unsaved changes"
                    : "Saved"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 text-slate-200 hover:bg-slate-800 text-[11px]"
              disabled={!scheduleDirty || saveMutation.isPending || !draftDays}
              title={
                scheduleSaveBlocked
                  ? "Revert local schedule edits. Saving to the server still requires signed contracts."
                  : undefined
              }
              onClick={() => {
                if (savedSchedule) {
                  pickerDayIdRef.current = null;
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
              disabled={!scheduleDirty || saveMutation.isPending || !draftDays || scheduleSaveBlocked}
              title={
                scheduleSaveBlocked
                  ? "Sign all project contracts in Legal & Contracts before saving the schedule."
                  : undefined
              }
              onClick={() => persistSchedule()}
            >
              Save
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <ToolViewButton
              onClick={() => setScheduleViewOpen(true)}
              count={(savedSchedule ?? draftDays ?? []).length}
              disabled={!(savedSchedule ?? draftDays)?.length}
            />
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
        {scheduleMessage ? (
          <p className="text-[11px] text-slate-400">{scheduleMessage}</p>
        ) : null}
        </div>
      </header>

      <ToolSavedViewSheet
        open={scheduleViewOpen}
        onClose={() => setScheduleViewOpen(false)}
        title="Production schedule"
        subtitle="Saved shoot days, call times, locations, and assigned scenes."
      >
        <ScheduleSavedViewer
          days={(savedSchedule ?? draftDays ?? []).map((d) => ({
            id: d.id,
            date: typeof d.date === "string" ? d.date : new Date(d.date).toISOString(),
            unit: d.unit,
            callTime: d.callTime,
            wrapTime: d.wrapTime,
            locationSummary: d.locationSummary,
            status: d.status,
            scenes: d.scenes,
          }))}
        />
      </ToolSavedViewSheet>

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
              href={`/creator/projects/${projectId}/pre-production/budget-builder`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
            >
              AI Budget Studio
            </Link>
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
      {data?.contractGate?.blocking ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/95 space-y-2">
          <p className="font-medium text-amber-200/90">
            Schedule save is blocked until contracts are signed ({data.contractGate.unsignedContracts} unsigned).
          </p>
          {data.contractGate.unsignedDetails.length > 0 ? (
            <ul className="list-disc pl-4 space-y-0.5">
              {data.contractGate.unsignedDetails.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  {(entry.subject || entry.type).trim()} · {entry.status}
                  {entry.party ? ` · ${entry.party}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {projectId ? (
            <Link
              href={`/creator/projects/${projectId}/pre-production/legal-contracts`}
              className="inline-flex text-[11px] font-medium text-amber-200 underline underline-offset-2 hover:text-amber-100"
            >
              Open Legal & Contracts
            </Link>
          ) : null}
        </div>
      ) : null}

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
      {selectedDayConflicts.length > 0 && selectedDay && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-100/90 space-y-1"
          role="status"
        >
          <p className="font-medium text-red-200/90">Conflict detection</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {selectedDayConflicts.map((c, i) => (
              <li key={`${c.type}-${i}`}>
                [{c.severity}] {c.message}
              </li>
            ))}
          </ul>
        </div>
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
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (!raw) return;
                            const nextIso = new Date(`${raw}T00:00:00.000Z`).toISOString();
                            updateDayField(selectedDay.id, "date", nextIso);
                          }}
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400">Unit</label>
                        <select
                          value={selectedDay.unit ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "unit", e.target.value || null)
                          }
                          className="w-full h-9 rounded-md bg-slate-900 border border-slate-700 px-2 text-[11px] text-white outline-none focus:border-orange-500"
                        >
                          <option value="">—</option>
                          <option value="A">Unit A (main)</option>
                          <option value="B">Unit B (second)</option>
                          <option value="C">Unit C</option>
                          <option value="2nd">2nd unit</option>
                        </select>
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
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-slate-400">Weather</label>
                        <Input
                          value={selectedDay.weather ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "weather", e.target.value || null)
                          }
                          placeholder="Sunny, overcast, rain risk..."
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1 min-[480px]:col-span-2">
                        <label className="text-slate-400">Transport details</label>
                        <Input
                          value={selectedDay.transportDetails ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "transportDetails", e.target.value || null)
                          }
                          placeholder="Crew vans, truck dispatch, ETA..."
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400">Pickup / drop-off</label>
                        <Input
                          value={selectedDay.pickupDropoffInfo ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "pickupDropoffInfo", e.target.value || null)
                          }
                          placeholder="Basecamp 06:00, drop 19:30"
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400">Accommodation</label>
                        <Input
                          value={selectedDay.accommodation ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "accommodation", e.target.value || null)
                          }
                          placeholder="Hotel / guest house details"
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400">Catering notes</label>
                        <Input
                          value={selectedDay.cateringNotes ?? ""}
                          onChange={(e) =>
                            updateDayField(selectedDay.id, "cateringNotes", e.target.value || null)
                          }
                          placeholder="Meal windows, dietary notes"
                          className="bg-slate-900 border-slate-700 text-[11px]"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-500">
                        Logistics fields sync to call sheets and feed transport/accommodation budget lines.
                      </p>
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
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Call sheet notes</label>
                      <textarea
                        rows={3}
                        value={selectedDay.callSheetNotes ?? ""}
                        onChange={(e) =>
                          updateDayField(selectedDay.id, "callSheetNotes", e.target.value || null)
                        }
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                        placeholder="Parking map, safety briefing, emergency contacts..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {(() => {
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
                    {
                      title: "Makeup & hair",
                      rows: dayAggregate.makeups.map((m) => ({
                        a: m.character || "—",
                        b: `${m.text} · Sc. ${m.sceneNums.join(", ")}`,
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
                        <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Scene selection for this day</CardTitle>
                            <p className="text-[11px] text-slate-500 font-normal mt-1">
                              Select scenes for this shoot day. Selections auto-link to breakdown, cast, crew, and equipment previews below — save the schedule to persist.
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {scenePickerIds.length === 0 ? (
                                <span className="text-[10px] text-slate-500">No scenes selected.</span>
                              ) : (
                                scenePickerIds.map((id) => {
                                  const scene = allScenesSorted.find((s) => s.id === id);
                                  const label = scene?.number ?? id.slice(0, 6);
                                  return (
                                    <button
                                      key={id}
                                      type="button"
                                      onClick={() =>
                                        setScenePickerIds((prev) => prev.filter((x) => x !== id))
                                      }
                                      className="rounded-full border border-orange-500/60 bg-orange-500/15 px-2 py-0.5 text-[10px] text-orange-100 transition hover:border-red-400/50 hover:bg-red-500/10"
                                      title="Remove from this day"
                                    >
                                      Sc. {label} ×
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <select
                              multiple
                              value={scenePickerIds}
                              onChange={(e) => {
                                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                                setScenePickerIds(values);
                              }}
                              className="h-40 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-orange-500"
                            >
                              {allScenesSorted.map((scene) => {
                                const onOtherDay = assignedToOtherDayIds.has(scene.id);
                                return (
                                  <option key={scene.id} value={scene.id}>
                                    {`Sc. ${scene.number} ${scene.heading || "Untitled scene"}${
                                      onOtherDay ? " (on another day)" : ""
                                    }`}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-slate-700 text-[11px]"
                                disabled={!scheduleDirty || saveMutation.isPending}
                                onClick={() => persistSchedule()}
                              >
                                Save schedule
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-400">
                        {scenePickerIds.length === 0
                          ? "No scenes selected for this day yet."
                          : `${scenePickerIds.length} scene${scenePickerIds.length === 1 ? "" : "s"} selected for this day.`}
                      </div>

                      {(scenePickerIds.length > 0 || selectedDay.scenes.length > 0) && (
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
                      )}

                      {pipelineDisplay && (
                        <Card className="creator-glass-panel border-0 bg-transparent text-slate-50 shadow-none">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Production day output pipeline</CardTitle>
                            <p className="text-[11px] text-slate-500 font-normal mt-1">
                              {scheduleDirty || pickerDiffersFromSaved
                                ? "Live preview from your selection — apply scenes and save to persist."
                                : "Structured output from scenes, cast, crew, locations, and equipment."}
                              {pipelineDisplay.unit ? ` · Unit ${pipelineDisplay.unit}` : ""}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3 text-[11px]">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Scenes</p>
                                <ul className="space-y-1 text-slate-300 max-h-36 overflow-y-auto">
                                  {pipelineDisplay.scenes.length === 0 ? (
                                    <li className="text-slate-500">No scenes selected yet.</li>
                                  ) : (
                                    pipelineDisplay.scenes.map((s) => (
                                      <li key={`${s.sceneId}-${s.order}`}>
                                        Sc. {s.number} · {s.estimatedShootDurationMinutes}m
                                        {s.heading ? ` · ${s.heading}` : ""}
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Cast required</p>
                                <ul className="space-y-1 text-slate-300 max-h-36 overflow-y-auto">
                                  {pipelineDisplay.castRequired.length === 0 ? (
                                    <li className="text-slate-500">No cast linked yet.</li>
                                  ) : (
                                    pipelineDisplay.castRequired.map((c) => (
                                      <li key={c.key}>
                                        {c.name} · {c.roleOrCharacter}
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Crew required</p>
                                <ul className="space-y-1 text-slate-300 max-h-36 overflow-y-auto">
                                  {pipelineDisplay.crewRequired.length === 0 ? (
                                    <li className="text-slate-500">No crew roles linked yet.</li>
                                  ) : (
                                    pipelineDisplay.crewRequired.map((c) => (
                                      <li key={c.key}>
                                        {c.role} · {c.department}
                                        {"name" in c && c.name ? ` · ${c.name}` : ""}
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Equipment</p>
                                <ul className="space-y-1 text-slate-300 max-h-36 overflow-y-auto">
                                  {pipelineDisplay.equipmentRequired.length === 0 ? (
                                    <li className="text-slate-500">No equipment items linked yet.</li>
                                  ) : (
                                    pipelineDisplay.equipmentRequired.map((e) => (
                                      <li key={e.key}>
                                        {e.equipmentName} · {e.category} · Qty {e.quantity}
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                    </div>
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
function emptyRoleEdit() {
  return {
    actorName: "",
    actorEmail: "",
    actorPhone: "",
    agentName: "",
    actorNotes: "",
    salaryAmount: "",
    dailyRate: "",
  };
}

function CastingPortalWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["project-casting", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/casting`),
    enabled: hasProject,
  });
  const { data: invitationsData } = useQuery({
    queryKey: ["project-casting-invitations", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/casting/invitations`),
    enabled: hasProject,
  });
  const roles = useMemo(
    () =>
      ((rolesData?.roles ?? []) as {
        id: string;
        name: string;
        description: string | null;
        status: string;
        invitationsCount: number;
        castInvitations: number;
        linkedSalary?: { amount: number } | null;
        assignedCast?: { name: string; contactEmail: string | null; notes: string | null } | null;
      }[]),
    [rolesData?.roles],
  );
  const invitations = (invitationsData ?? []) as {
    id: string;
    status: string;
    createdAt: string;
    role: { id: string; name: string };
    castingAgency: { id: string; agencyName: string } | null;
    talent: { id: string; name: string } | null;
  }[];
  const [roleEdits, setRoleEdits] = useState<
    Record<
      string,
      {
        actorName: string;
        actorEmail: string;
        actorPhone: string;
        agentName: string;
        actorNotes: string;
        salaryAmount: string;
        dailyRate: string;
      }
    >
  >({});
  const [portalMessage, setPortalMessage] = useState("");
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
  const updateRoleMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      actorName: string;
      actorEmail: string;
      actorPhone: string;
      agentName: string;
      actorNotes: string;
      salaryAmount: number | null;
      dailyRate: number | null;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/casting`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payload.id,
          actorName: payload.actorName || null,
          actorEmail: payload.actorEmail || null,
          actorPhone: payload.actorPhone || null,
          agentName: payload.agentName || null,
          actorNotes: payload.actorNotes || null,
          salaryAmount: payload.salaryAmount,
          dailyRate: payload.dailyRate,
          markCast: Boolean(payload.actorName),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      setPortalMessage("Role and salary saved.");
      invalidateProjectPipeline(queryClient, projectId, ["casting"]);
    },
  });
  const confirmHireMutation = useMutation({
    mutationFn: async (payload: { invitationId: string; salaryAmount: number; salaryNotes?: string }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/casting/confirm-hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to confirm hire");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      setPortalMessage(
        `Hire confirmed. Contract draft created and acquisition fee paid (${formatZar(CASTING_ACQUISITION_FEE_ZAR)}).`,
      );
      invalidateProjectPipeline(queryClient, projectId, ["casting", "contracts"]);
      queryClient.invalidateQueries({ queryKey: ["project-casting-invitations", projectId] });
    },
  });
  const [newName, setNewName] = useState("");
  useEffect(() => {
    if (roles.length === 0) return;

    setRoleEdits((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const r of roles) {
        if (!next[r.id]) {
          const notes = r.assignedCast?.notes ?? "";
          const phoneMatch = notes.match(/Phone:\s*([^\n]+)/i);
          const agentMatch = notes.match(/Agent:\s*([^\n]+)/i);
          next[r.id] = {
            actorName: r.assignedCast?.name ?? "",
            actorEmail: r.assignedCast?.contactEmail ?? "",
            actorPhone: phoneMatch?.[1]?.trim() ?? "",
            agentName: agentMatch?.[1]?.trim() ?? "",
            actorNotes: notes.replace(/Phone:\s*[^\n]+\n?/gi, "").replace(/Agent:\s*[^\n]+\n?/gi, "").trim(),
            salaryAmount:
              r.linkedSalary?.amount !== undefined && r.linkedSalary?.amount !== null
                ? String(r.linkedSalary.amount)
                : "",
            dailyRate: "",
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [roles]);
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
                invalidateProjectPipeline(queryClient, projectId, ["casting"]);
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
      
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-4 space-y-4">
          {portalMessage && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {portalMessage}
            </p>
          )}
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
              <div className="space-y-2.5">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-3 text-sm space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white font-medium">{r.name}</span>
                      <div className="flex items-center gap-2">
                        {hasProject && projectId && (
                          <Link
                            href={`/creator/projects/${projectId}/pre-production/legal-contracts?templateType=ACTOR_AGREEMENT&resourceType=ACTOR&resourceId=${r.id}`}
                            className="text-[10px] text-orange-300 hover:text-orange-200 underline"
                          >
                            Generate contract
                          </Link>
                        )}
                        <span className="text-xs text-slate-400">
                          {r.status} · {r.invitationsCount} invite(s)
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input
                        value={roleEdits[r.id]?.actorName ?? ""}
                        onChange={(e) =>
                          setRoleEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? emptyRoleEdit()), actorName: e.target.value },
                          }))
                        }
                        placeholder="Performer name"
                        className="bg-slate-950 border-slate-700 text-xs"
                      />
                      <Input
                        value={roleEdits[r.id]?.actorEmail ?? ""}
                        onChange={(e) =>
                          setRoleEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? emptyRoleEdit()), actorEmail: e.target.value },
                          }))
                        }
                        placeholder="Email"
                        className="bg-slate-950 border-slate-700 text-xs"
                      />
                      <Input
                        value={roleEdits[r.id]?.actorPhone ?? ""}
                        onChange={(e) =>
                          setRoleEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? emptyRoleEdit()), actorPhone: e.target.value },
                          }))
                        }
                        placeholder="Phone / WhatsApp"
                        className="bg-slate-950 border-slate-700 text-xs"
                      />
                      <Input
                        value={roleEdits[r.id]?.agentName ?? ""}
                        onChange={(e) =>
                          setRoleEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? emptyRoleEdit()), agentName: e.target.value },
                          }))
                        }
                        placeholder="Agent / agency contact"
                        className="bg-slate-950 border-slate-700 text-xs"
                      />
                      <Input
                        value={roleEdits[r.id]?.salaryAmount ?? ""}
                        onChange={(e) =>
                          setRoleEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? emptyRoleEdit()), salaryAmount: e.target.value },
                          }))
                        }
                        placeholder="Total fee (ZAR) → budget"
                        className="bg-slate-950 border-slate-700 text-xs"
                      />
                      <Input
                        value={roleEdits[r.id]?.dailyRate ?? ""}
                        onChange={(e) =>
                          setRoleEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...(prev[r.id] ?? emptyRoleEdit()), dailyRate: e.target.value },
                          }))
                        }
                        placeholder="Day rate (ZAR)"
                        className="bg-slate-950 border-slate-700 text-xs"
                      />
                    </div>
                    <textarea
                      value={roleEdits[r.id]?.actorNotes ?? ""}
                      onChange={(e) =>
                        setRoleEdits((prev) => ({
                          ...prev,
                          [r.id]: { ...(prev[r.id] ?? emptyRoleEdit()), actorNotes: e.target.value },
                        }))
                      }
                      rows={2}
                      placeholder="Notes — availability, special requirements, union status…"
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-xs"
                        disabled={updateRoleMutation.isPending}
                        onClick={() =>
                          updateRoleMutation.mutate({
                            id: r.id,
                            actorName: roleEdits[r.id]?.actorName ?? "",
                            actorEmail: roleEdits[r.id]?.actorEmail ?? "",
                            actorPhone: roleEdits[r.id]?.actorPhone ?? "",
                            agentName: roleEdits[r.id]?.agentName ?? "",
                            actorNotes: roleEdits[r.id]?.actorNotes ?? "",
                            salaryAmount:
                              roleEdits[r.id]?.salaryAmount?.trim()
                                ? Number(roleEdits[r.id]?.salaryAmount)
                                : null,
                            dailyRate:
                              roleEdits[r.id]?.dailyRate?.trim()
                                ? Number(roleEdits[r.id]?.dailyRate)
                                : null,
                          })
                        }
                      >
                        Save cast + link to budget
                      </Button>
                    </div>
                    {r.linkedSalary?.amount != null && (
                      <p className="text-[10px] text-emerald-400/90">
                        Budget line: {formatZar(r.linkedSalary.amount)} (CAST department)
                      </p>
                    )}
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
          {invitations
            .filter((inv) => inv.status === "ACCEPTED" && inv.talent)
            .slice(0, 6)
            .map((inv) => (
              <div key={`accepted-${inv.id}`} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                <div className="flex items-center justify-between gap-2">
                  <p>
                    {inv.role.name} accepted by {inv.talent?.name} ({inv.castingAgency?.agencyName ?? "agency"}).
                  </p>
                  <Button
                    size="sm"
                    className="h-7 bg-emerald-600 hover:bg-emerald-700 text-[11px]"
                    disabled={confirmHireMutation.isPending}
                    onClick={() => {
                      const salaryInput =
                        typeof window !== "undefined"
                          ? window.prompt(`Planned salary for ${inv.role.name} (ZAR):`, "0")
                          : "0";
                      const salaryAmount = Number(salaryInput ?? "0") || 0;
                      confirmHireMutation.mutate({
                        invitationId: inv.id,
                        salaryAmount,
                        salaryNotes: `Linked from accepted invitation ${inv.id}`,
                      });
                    }}
                  >
                    Create contract + pay {formatZar(CASTING_ACQUISITION_FEE_ZAR)}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}
      <Link
        href={projectId ? `/creator/cast?projectId=${encodeURIComponent(projectId)}` : "/creator/cast"}
        className="storytime-plan-card block p-5 transition hover:border-orange-400/40 group"
      >
        <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-orange-200">Open Cast &amp; Auditions marketplace</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Browse agency talent with headshots, rates, and experience — send free inquiries, post paid auditions, and manage your cast roster.
        </p>
      </Link>
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
  const [filterCity, setFilterCity] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterSkill, setFilterSkill] = useState("");
  const [selectedNeedId, setSelectedNeedId] = useState("");
  const [portalMessage, setPortalMessage] = useState("");
  const [newNeedRole, setNewNeedRole] = useState("");
  const [newNeedDepartment, setNewNeedDepartment] = useState("");
  const [newNeedSeniority, setNewNeedSeniority] = useState("");
  const [newNeedNotes, setNewNeedNotes] = useState("");
  const [newInternalName, setNewInternalName] = useState("");
  const [newInternalRole, setNewInternalRole] = useState("");
  const [newInternalDepartment, setNewInternalDepartment] = useState("");
  const [newInternalEmail, setNewInternalEmail] = useState("");
  const [newInternalPhone, setNewInternalPhone] = useState("");

  const directoryQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filterCity.trim()) params.set("city", filterCity.trim());
    if (filterCountry.trim()) params.set("country", filterCountry.trim());
    if (filterRole.trim()) params.set("role", filterRole.trim());
    if (filterDepartment.trim()) params.set("department", filterDepartment.trim());
    if (filterSkill.trim()) params.set("specialization", filterSkill.trim());
    const query = params.toString();
    return query ? `/api/crew-teams?${query}` : "/api/crew-teams";
  }, [filterCity, filterCountry, filterRole, filterDepartment, filterSkill]);

  const { data, isLoading } = useQuery({
    queryKey: ["project-crew", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/crew`),
    enabled: hasProject,
  });
  const { data: crewDirectoryData, isLoading: isDirectoryLoading } = useQuery({
    queryKey: ["crew-teams-directory", directoryQuery],
    queryFn: projectToolQueryFn(directoryQuery),
    enabled: true,
  });
  const { data: internalRosterData, isLoading: isInternalLoading } = useQuery({
    queryKey: ["creator-crew-roster"],
    queryFn: projectToolQueryFn("/api/creator/crew-roster"),
    enabled: true,
  });
  const needs = useMemo(
    () =>
      ((data?.needs ?? []) as {
        id: string;
        department: string | null;
        role: string;
        seniority: string | null;
        notes: string | null;
        invitationsCount: number;
        linkedRate?: number | null;
        assignedCrew?: string | null;
      }[]),
    [data?.needs],
  );
  const crewDirectory = (crewDirectoryData ?? []) as Array<{
    id: string;
    companyName: string;
    city: string | null;
    country: string | null;
    specializations: string | null;
    members?: Array<{
      id: string;
      name: string;
      role: string;
      department: string | null;
      experienceLevel?: string | null;
      dailyRate?: number | null;
      skills: string[];
      portfolio?: string | null;
      availability?: string | null;
    }>;
    _count?: { members?: number; requests?: number };
  }>;
  const internalRoster = (internalRosterData ?? []) as Array<{
    id: string;
    name: string;
    role: string | null;
    department: string | null;
    contactEmail: string | null;
    phone: string | null;
    notes: string | null;
    pastProjects: string | null;
  }>;

  const [needEdits, setNeedEdits] = useState<
    Record<
      string,
      {
        role: string;
        department: string;
        seniority: string;
        notes: string;
        hireName: string;
        hireEmail: string;
        hirePhone: string;
        dailyRate: string;
      }
    >
  >({});

  const needsContext =
    needs.length > 0
      ? needs
          .map(
            (n) =>
              `${n.role}${n.department ? ` (${n.department})` : ""}${n.seniority ? `, ${n.seniority}` : ""}${n.notes ? ` — ${n.notes}` : ""}${n.assignedCrew ? ` | Assigned: ${n.assignedCrew}` : ""}${n.linkedRate != null ? ` | Rate: ${formatZar(n.linkedRate, { maximumFractionDigits: 0 })}` : ""}`,
          )
          .join("\n")
      : "No crew needs yet. Add a role to start.";
  const createMutation = useMutation({
    mutationFn: async (payload: {
      role: string;
      department: string;
      seniority: string;
      notes: string;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: payload.role,
          department: payload.department || null,
          seniority: payload.seniority || null,
          notes: payload.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to add need");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-crew", projectId] });
      setNewNeedRole("");
      setNewNeedDepartment("");
      setNewNeedSeniority("");
      setNewNeedNotes("");
      setPortalMessage("Crew need added.");
    },
  });
  const updateNeedMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      role: string;
      department: string;
      seniority: string;
      notes: string;
      hireName: string;
      hireEmail: string;
      hirePhone: string;
      dailyRate: string;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/crew`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: payload.id,
          role: payload.role,
          department: payload.department || null,
          seniority: payload.seniority || null,
          notes: payload.notes || null,
          hireName: payload.hireName || null,
          hireEmail: payload.hireEmail || null,
          hirePhone: payload.hirePhone || null,
          dailyRate: payload.dailyRate.trim() ? Number(payload.dailyRate) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to update need");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-crew", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-budget", projectId] });
      setPortalMessage("Crew need, assignment, and budget rate saved.");
    },
  });
  const inviteTeamMutation = useMutation({
    mutationFn: async (payload: { crewTeamId: string; message: string }) => {
      const res = await fetch("/api/crew-teams/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewTeamId: payload.crewTeamId,
          projectName: projectId ?? null,
          message: payload.message,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to send crew request");
      }
      return res.json();
    },
    onSuccess: () => setPortalMessage("Crew team request sent."),
  });
  const createInternalMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/crew-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newInternalName,
          role: newInternalRole || null,
          department: newInternalDepartment || null,
          contactEmail: newInternalEmail || null,
          phone: newInternalPhone || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to add internal crew member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-crew-roster"] });
      setNewInternalName("");
      setNewInternalRole("");
      setNewInternalDepartment("");
      setNewInternalEmail("");
      setNewInternalPhone("");
      setPortalMessage("Internal crew member recorded.");
    },
  });
  const deleteInternalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/creator/crew-roster/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-crew-roster"] });
      setPortalMessage("Internal crew member removed.");
    },
  });

  useEffect(() => {
    if (needs.length === 0) return;
    if (!selectedNeedId || !needs.some((n) => n.id === selectedNeedId)) {
      setSelectedNeedId(needs[0].id);
    }
    setNeedEdits((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const n of needs) {
        if (!next[n.id]) {
          next[n.id] = {
            role: n.role,
            department: n.department ?? "",
            seniority: n.seniority ?? "",
            notes: n.notes ?? "",
            hireName: n.assignedCrew ?? "",
            hireEmail: "",
            hirePhone: "",
            dailyRate: n.linkedRate != null ? String(n.linkedRate) : "",
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [needs, selectedNeedId]);

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
              Build a serious hiring pipeline across marketplace companies, independent professionals,
              and your internal team roster. All selections can be tracked against project roles and rates.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            
          </div>
        </div>
      </header>
      
      {portalMessage && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {portalMessage}
        </p>
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-4 space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <Input value={newNeedRole} onChange={(e) => setNewNeedRole(e.target.value)} placeholder="Need role (e.g. 1st AD)" className="bg-slate-900 border-slate-700 text-xs" />
            <Input value={newNeedDepartment} onChange={(e) => setNewNeedDepartment(e.target.value)} placeholder="Department" className="bg-slate-900 border-slate-700 text-xs" />
            <Input value={newNeedSeniority} onChange={(e) => setNewNeedSeniority(e.target.value)} placeholder="Seniority" className="bg-slate-900 border-slate-700 text-xs" />
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-xs"
              disabled={!hasProject || createMutation.isPending || !newNeedRole.trim()}
              onClick={() =>
                createMutation.mutate({
                  role: newNeedRole.trim(),
                  department: newNeedDepartment,
                  seniority: newNeedSeniority,
                  notes: newNeedNotes,
                })
              }
            >
              Add crew need
            </Button>
          </div>
          <textarea
            value={newNeedNotes}
            onChange={(e) => setNewNeedNotes(e.target.value)}
            rows={2}
            placeholder="Need notes / scope / shoot day requirements..."
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
          />
          {needs.length === 0 ? (
            <p className="text-xs text-slate-500 p-4">
              {!hasProject ? "Link a project above to manage crew needs." : "No crew needs yet. Add a role to start."}
            </p>
          ) : (
            <div className="space-y-2">
              {needs.map((n) => (
                <div key={n.id} className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 text-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-medium">{n.role}</p>
                    <p className="text-[11px] text-slate-400">
                      {n.department ?? "No department"} · {n.invitationsCount} request(s)
                      {n.assignedCrew ? ` · Assigned: ${n.assignedCrew}` : ""}
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Input
                      value={needEdits[n.id]?.role ?? ""}
                      onChange={(e) =>
                        setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), role: e.target.value } }))
                      }
                      placeholder="Role"
                      className="bg-slate-950 border-slate-700 text-xs"
                    />
                    <Input
                      value={needEdits[n.id]?.department ?? ""}
                      onChange={(e) =>
                        setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), department: e.target.value } }))
                      }
                      placeholder="Department"
                      className="bg-slate-950 border-slate-700 text-xs"
                    />
                    <Input
                      value={needEdits[n.id]?.seniority ?? ""}
                      onChange={(e) =>
                        setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), seniority: e.target.value } }))
                      }
                      placeholder="Seniority"
                      className="bg-slate-950 border-slate-700 text-xs"
                    />
                    <Input
                      value={needEdits[n.id]?.dailyRate ?? ""}
                      onChange={(e) =>
                        setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), dailyRate: e.target.value } }))
                      }
                      placeholder="Day rate (ZAR)"
                      className="bg-slate-950 border-slate-700 text-xs"
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input
                      value={needEdits[n.id]?.hireName ?? ""}
                      onChange={(e) =>
                        setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), hireName: e.target.value } }))
                      }
                      placeholder="Assigned person / team contact"
                      className="bg-slate-950 border-slate-700 text-xs"
                    />
                    <Input
                      value={needEdits[n.id]?.hireEmail ?? ""}
                      onChange={(e) =>
                        setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), hireEmail: e.target.value } }))
                      }
                      placeholder="Contact email"
                      className="bg-slate-950 border-slate-700 text-xs"
                    />
                    <Input
                      value={needEdits[n.id]?.hirePhone ?? ""}
                      onChange={(e) =>
                        setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), hirePhone: e.target.value } }))
                      }
                      placeholder="Phone"
                      className="bg-slate-950 border-slate-700 text-xs"
                    />
                  </div>
                  <textarea
                    value={needEdits[n.id]?.notes ?? ""}
                    onChange={(e) =>
                      setNeedEdits((prev) => ({ ...prev, [n.id]: { ...(prev[n.id] ?? { role: "", department: "", seniority: "", notes: "", hireName: "", hireEmail: "", hirePhone: "", dailyRate: "" }), notes: e.target.value } }))
                    }
                    rows={2}
                    placeholder="Notes, scene/day assignment scope, requirements..."
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-xs"
                      disabled={updateNeedMutation.isPending}
                      onClick={() =>
                        updateNeedMutation.mutate({
                          id: n.id,
                          role: needEdits[n.id]?.role ?? n.role,
                          department: needEdits[n.id]?.department ?? "",
                          seniority: needEdits[n.id]?.seniority ?? "",
                          notes: needEdits[n.id]?.notes ?? "",
                          hireName: needEdits[n.id]?.hireName ?? "",
                          hireEmail: needEdits[n.id]?.hireEmail ?? "",
                          hirePhone: needEdits[n.id]?.hirePhone ?? "",
                          dailyRate: needEdits[n.id]?.dailyRate ?? "",
                        })
                      }
                    >
                      Save need + assignment
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <div className="grid gap-2 md:grid-cols-5">
              <Input value={filterCity} onChange={(e) => setFilterCity(e.target.value)} placeholder="City" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} placeholder="Country" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={filterRole} onChange={(e) => setFilterRole(e.target.value)} placeholder="Role" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} placeholder="Department" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} placeholder="Skill / specialization" className="bg-slate-900 border-slate-700 text-xs" />
            </div>
            <h3 className="text-sm font-semibold text-white">Marketplace teams and independent professionals</h3>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Target crew need for marketplace actions</p>
              <select
                value={selectedNeedId}
                onChange={(e) => setSelectedNeedId(e.target.value)}
                disabled={needs.length === 0}
                className="h-10 w-full md:w-[340px] rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {needs.length === 0 ? (
                  <option value="">No crew needs yet</option>
                ) : (
                  needs.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.role}
                    </option>
                  ))
                )}
              </select>
            </div>
            {isDirectoryLoading ? (
              <Skeleton className="h-24 bg-slate-800/60" />
            ) : crewDirectory.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">No marketplace matches for current filters.</p>
            ) : (
              <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
                {crewDirectory.map((team) => (
                  <div key={team.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white font-medium">{team.companyName}</p>
                        <p className="text-[11px] text-slate-500">
                          {[team.city, team.country].filter(Boolean).join(", ") || "Location not specified"}
                          {team.specializations ? ` · ${team.specializations}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-700 text-[11px]"
                        disabled={inviteTeamMutation.isPending || !hasProject}
                        onClick={() =>
                          inviteTeamMutation.mutate({
                            crewTeamId: team.id,
                            message: selectedNeedId
                              ? `Project crew request for ${needs.find((n) => n.id === selectedNeedId)?.role ?? "selected role"}.`
                              : "Project crew request from Crew Marketplace.",
                          })
                        }
                      >
                        Send team request
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {(team.members ?? []).slice(0, 8).map((member) => (
                        <div key={member.id} className="rounded-md border border-slate-800 px-2 py-1.5 text-[11px] flex items-center justify-between gap-2">
                          <div>
                            <p className="text-slate-200">{member.name} · {member.role}</p>
                            <p className="text-slate-500">
                              {member.department ?? "No department"}
                              {member.experienceLevel ? ` · ${member.experienceLevel}` : ""}
                              {member.dailyRate != null ? ` · ${formatZar(member.dailyRate, { maximumFractionDigits: 0 })}/day` : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 border-slate-700 px-2 text-[10px]"
                            disabled={!selectedNeedId}
                            onClick={() => {
                              const need = needs.find((n) => n.id === selectedNeedId);
                              if (!need) return;
                              setNeedEdits((prev) => ({
                                ...prev,
                                [need.id]: {
                                  ...(prev[need.id] ?? {
                                    role: need.role,
                                    department: need.department ?? "",
                                    seniority: need.seniority ?? "",
                                    notes: need.notes ?? "",
                                    hireName: "",
                                    hireEmail: "",
                                    hirePhone: "",
                                    dailyRate: "",
                                  }),
                                  hireName: member.name,
                                  dailyRate: member.dailyRate != null ? String(member.dailyRate) : prev[need.id]?.dailyRate ?? "",
                                },
                              }));
                              setPortalMessage(`Prepared assignment from marketplace member ${member.name}. Save the need to persist.`);
                            }}
                          >
                            Assign to selected need
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <h3 className="text-sm font-semibold text-white">Internal team register (individuals / in-house)</h3>
            <div className="grid gap-2 md:grid-cols-5">
              <Input value={newInternalName} onChange={(e) => setNewInternalName(e.target.value)} placeholder="Name" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={newInternalRole} onChange={(e) => setNewInternalRole(e.target.value)} placeholder="Role" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={newInternalDepartment} onChange={(e) => setNewInternalDepartment(e.target.value)} placeholder="Department" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={newInternalEmail} onChange={(e) => setNewInternalEmail(e.target.value)} placeholder="Email" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={newInternalPhone} onChange={(e) => setNewInternalPhone(e.target.value)} placeholder="Phone" className="bg-slate-900 border-slate-700 text-xs" />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                disabled={createInternalMutation.isPending || !newInternalName.trim()}
                onClick={() => createInternalMutation.mutate()}
              >
                Add internal crew member
              </Button>
            </div>
            {isInternalLoading ? (
              <Skeleton className="h-16 bg-slate-800/60" />
            ) : internalRoster.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">No internal crew recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {internalRoster.map((member) => (
                  <div key={member.id} className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <div>
                      <p className="text-slate-200">{member.name} · {member.role ?? "Role not set"}</p>
                      <p className="text-slate-500">
                        {member.department ?? "No department"}
                        {member.contactEmail ? ` · ${member.contactEmail}` : ""}
                        {member.phone ? ` · ${member.phone}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 border-slate-700 px-2 text-[10px]"
                      onClick={() => deleteInternalMutation.mutate(member.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <Link
        href={projectId ? `/creator/crew?projectId=${encodeURIComponent(projectId)}` : "/creator/crew"}
        className="creator-glass-panel block p-4 transition hover:border-emerald-400/35"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Open Crew marketplace</h3>
        <p className="text-xs text-slate-400">Browse full crew teams directory and conversation threads.</p>
      </Link>
    </div>
  );
}

// --- Location Marketplace ---
function LocationMarketplaceWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [filterType, setFilterType] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterAvailability, setFilterAvailability] = useState("");
  const [filterMaxRate, setFilterMaxRate] = useState("");
  const [filterMinCapacity, setFilterMinCapacity] = useState("");
  const [selectedBreakdownLocationId, setSelectedBreakdownLocationId] = useState("");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [portalMessage, setPortalMessage] = useState("");
  const [ownLocationName, setOwnLocationName] = useState("");
  const [ownLocationAddress, setOwnLocationAddress] = useState("");
  const [ownLocationCity, setOwnLocationCity] = useState("");
  const [ownLocationNotes, setOwnLocationNotes] = useState("");
  const [ownLocationSceneIds, setOwnLocationSceneIds] = useState<string[]>([]);
  const [ownLocationSetPrimary, setOwnLocationSetPrimary] = useState(true);

  const listingQueryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filterType.trim()) params.set("type", filterType.trim());
    if (filterRegion.trim()) params.set("region", filterRegion.trim());
    if (filterAvailability.trim()) params.set("availability", filterAvailability.trim());
    if (filterMaxRate.trim()) params.set("maxDailyRate", filterMaxRate.trim());
    if (filterMinCapacity.trim()) params.set("minCapacity", filterMinCapacity.trim());
    const query = params.toString();
    return query ? `/api/locations?${query}` : "/api/locations";
  }, [filterType, filterRegion, filterAvailability, filterMaxRate, filterMinCapacity]);

  const { data: breakdown } = useQuery({
    queryKey: ["project-breakdown", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/breakdown`),
    enabled: hasProject,
  });
  const { data: scenesData } = useQuery({
    queryKey: ["project-scenes", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/scenes`),
    enabled: hasProject,
  });
  const { data: listingsData, isLoading: isListingsLoading } = useQuery({
    queryKey: ["locations-directory", listingQueryUrl],
    queryFn: projectToolQueryFn(listingQueryUrl),
    enabled: true,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/schedule`),
    enabled: hasProject,
  });
  const projectScenes = useMemo(
    () =>
      ((scenesData?.scenes ?? []) as Array<{
        id: string;
        number: string;
        heading: string | null;
      }>).slice().sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [scenesData?.scenes],
  );
  const locations = useMemo(
    () =>
      ((breakdown?.locations ?? []) as Array<{
        id: string;
        name: string;
        description: string | null;
        sceneId?: string | null;
        locationListingId?: string | null;
      }>),
    [breakdown?.locations],
  );
  const sceneLabelById = useMemo(
    () => new Map(projectScenes.map((s) => [s.id, `Sc. ${s.number}${s.heading ? ` · ${s.heading}` : ""}`])),
    [projectScenes],
  );
  const listings = (listingsData ?? []) as Array<{
    id: string;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
    capacity: number | null;
    description?: string | null;
    photos?: string[];
    previewImageUrl?: string | null;
    profile?: {
      permitRequirements?: string | null;
      restrictions?: string | null;
      logistics?: string | null;
      availability?: string | null;
    };
    _count?: { bookings?: number };
  }>;
  const shootDays = (scheduleData?.shootDays ?? []) as Array<{
    id: string;
    locationSummary: string | null;
    date: string;
  }>;
  const locationContext =
    locations.length > 0
      ? locations.map((l) => `${l.name}${l.description ? `: ${l.description}` : ""}`).join("\n")
      : "No breakdown locations yet. Add locations in Script Breakdown first.";
  const assignLocationMutation = useMutation({
    mutationFn: async (payload: { locationId: string; listingId: string }) => {
      const current = locations.find((l) => l.id === payload.locationId);
      if (!current) throw new Error("Breakdown location not found");
      const res = await fetch(`/api/creator/projects/${projectId}/breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: [
            {
              id: current.id,
              name: current.name,
              description: current.description,
              sceneId: current.sceneId ?? null,
              locationListingId: payload.listingId,
            },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to assign location");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateProjectPipeline(queryClient, projectId, ["locations"]);
      setPortalMessage("Marketplace location linked to breakdown.");
    },
  });

  const createOwnLocationMutation = useMutation({
    mutationFn: async () => {
      if (!hasProject || !projectId) throw new Error("Link a project first");
      const name = ownLocationName.trim();
      if (!name) throw new Error("Location name is required");

      const detailParts = [
        ownLocationAddress.trim() ? `Address: ${ownLocationAddress.trim()}` : "",
        ownLocationCity.trim() ? `City: ${ownLocationCity.trim()}` : "",
        ownLocationNotes.trim() || "",
        "Source: Creator-owned location (not marketplace)",
      ].filter(Boolean);
      const description = detailParts.join("\n") || null;

      const sceneIds =
        ownLocationSceneIds.length > 0 ? ownLocationSceneIds : [null as string | null];

      const payloadLocations = sceneIds.map((sceneId) => ({
        name,
        description,
        sceneId,
        locationListingId: null,
      }));

      const res = await fetch(`/api/creator/projects/${projectId}/breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: payloadLocations }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save your location");
      }

      // Reload locations to get created ids, then optionally set primary on scenes.
      const refreshed = await fetch(`/api/creator/projects/${projectId}/breakdown`).then((r) =>
        r.json(),
      );
      const created = ((refreshed?.locations ?? []) as Array<{
        id: string;
        name: string;
        sceneId?: string | null;
        description?: string | null;
      }>)
        .filter((l) => l.name.trim().toLowerCase() === name.toLowerCase())
        .filter((l) => (l.description ?? "").includes("Creator-owned location"));

      if (ownLocationSetPrimary && ownLocationSceneIds.length > 0) {
        const sceneUpdates = ownLocationSceneIds
          .map((sceneId) => {
            const match =
              created.find((l) => l.sceneId === sceneId) ??
              created.find((l) => !l.sceneId);
            if (!match) return null;
            return { id: sceneId, primaryLocationId: match.id };
          })
          .filter(Boolean) as Array<{ id: string; primaryLocationId: string }>;

        if (sceneUpdates.length > 0) {
          const sceneRes = await fetch(`/api/creator/projects/${projectId}/scenes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenes: sceneUpdates }),
          });
          if (!sceneRes.ok) {
            const err = await sceneRes.json().catch(() => null);
            throw new Error(err?.error || "Location saved, but could not set primary scene location");
          }
        }
      }

      return { createdCount: payloadLocations.length };
    },
    onSuccess: (result) => {
      invalidateProjectPipeline(queryClient, projectId, ["locations", "scenes"]);
      setOwnLocationName("");
      setOwnLocationAddress("");
      setOwnLocationCity("");
      setOwnLocationNotes("");
      setOwnLocationSceneIds([]);
      setPortalMessage(
        `Saved ${result.createdCount} creator-owned location link${result.createdCount === 1 ? "" : "s"} to this project.`,
      );
    },
    onError: (err) => {
      setPortalMessage((err as Error).message || "Could not save your location.");
    },
  });

  useEffect(() => {
    if (!selectedBreakdownLocationId && locations.length > 0) {
      setSelectedBreakdownLocationId(locations[0].id);
    }
  }, [locations, selectedBreakdownLocationId]);

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
              Add your own places, browse marketplace venues with photos, send free booking requests, and link locations to project scenes.
            </p>
          </div>
        </div>
      </header>

      {portalMessage && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {portalMessage}
        </p>
      )}

      <div className="creator-glass-panel p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Add your own location</h3>
          <p className="mt-1 text-xs text-slate-400">
            Not using the marketplace? Save a place you already have (home, office, private venue) and link it to the
            project scenes that need it.
          </p>
        </div>
        {!hasProject ? (
          <p className="text-xs text-amber-200/90">Link a project above to save your own locations.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Location name *</span>
                <Input
                  value={ownLocationName}
                  onChange={(e) => setOwnLocationName(e.target.value)}
                  placeholder="e.g. My apartment, Family farm, Studio warehouse"
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">City / area</span>
                <Input
                  value={ownLocationCity}
                  onChange={(e) => setOwnLocationCity(e.target.value)}
                  placeholder="e.g. Durban, Cape Town"
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Address</span>
                <Input
                  value={ownLocationAddress}
                  onChange={(e) => setOwnLocationAddress(e.target.value)}
                  placeholder="Street address or directions"
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Notes / logistics</span>
                <Input
                  value={ownLocationNotes}
                  onChange={(e) => setOwnLocationNotes(e.target.value)}
                  placeholder="Parking, access hours, power, restrictions…"
                  className="bg-slate-900 border-slate-700 text-xs"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Link to scenes (optional — leave empty for project-wide)
              </p>
              {projectScenes.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No scenes yet. Sync scenes from Script Writing / Breakdown first to attach this location to specific
                  scenes.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2 space-y-1">
                  {projectScenes.map((scene) => {
                    const checked = ownLocationSceneIds.includes(scene.id);
                    return (
                      <label
                        key={scene.id}
                        className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-900/80"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          onChange={(e) => {
                            setOwnLocationSceneIds((prev) =>
                              e.target.checked
                                ? [...prev, scene.id]
                                : prev.filter((id) => id !== scene.id),
                            );
                          }}
                        />
                        <span>
                          Sc. {scene.number}
                          {scene.heading ? ` · ${scene.heading}` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <label className="flex items-center gap-2 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={ownLocationSetPrimary}
                  onChange={(e) => setOwnLocationSetPrimary(e.target.checked)}
                />
                Set as primary location on selected scenes (used in schedule / call sheets)
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                disabled={!ownLocationName.trim() || createOwnLocationMutation.isPending}
                onClick={() => createOwnLocationMutation.mutate()}
              >
                {createOwnLocationMutation.isPending ? "Saving…" : "Save my location to project"}
              </Button>
              {ownLocationSceneIds.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-700 text-xs text-slate-300"
                  onClick={() => setOwnLocationSceneIds([])}
                >
                  Clear scene selection
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="creator-glass-panel p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white">Project locations</h3>
        <p className="text-xs text-slate-400">
          Locations from your script breakdown and any places you added yourself. Link marketplace listings only when you
          need an external venue.
        </p>
        {locations.length === 0 ? (
          <p className="text-xs text-slate-500 p-4">
            {!hasProject
              ? "Link a project above to manage locations."
              : "No locations yet. Add your own above, or create them in Script Breakdown."}
          </p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => {
              const linked = listings.find((l) => l.id === loc.locationListingId);
              const isOwn = !loc.locationListingId;
              const usageCount = shootDays.filter((d) =>
                (d.locationSummary ?? "").toLowerCase().includes(loc.name.toLowerCase()),
              ).length;
              const sceneLabel = loc.sceneId ? sceneLabelById.get(loc.sceneId) : null;
              return (
                <div
                  key={loc.id}
                  className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2.5 text-sm space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-white font-medium">{loc.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isOwn
                            ? "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
                            : "bg-orange-500/15 text-orange-200 border border-orange-500/30"
                        }`}
                      >
                        {isOwn ? "Your location" : "Marketplace"}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {usageCount} shoot day(s) currently referencing this location
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 whitespace-pre-wrap">
                    {loc.description || "No description provided."}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Scene: {sceneLabel ?? "Project-wide (not scene-specific)"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {linked
                      ? `Linked marketplace listing: ${linked.name} (${linked.city ?? "Unknown city"})`
                      : isOwn
                        ? "Creator-owned — no marketplace listing required"
                        : "Not linked to a marketplace listing"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="creator-glass-panel p-4 space-y-4">
        <div className="grid gap-2 md:grid-cols-5">
          <Input value={filterType} onChange={(e) => setFilterType(e.target.value)} placeholder="Type (studio, house...)" className="bg-slate-900 border-slate-700 text-xs" />
          <Input value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} placeholder="Region / city" className="bg-slate-900 border-slate-700 text-xs" />
          <Input value={filterAvailability} onChange={(e) => setFilterAvailability(e.target.value)} placeholder="Availability" className="bg-slate-900 border-slate-700 text-xs" />
          <Input value={filterMaxRate} onChange={(e) => setFilterMaxRate(e.target.value)} placeholder="Max daily rate (filter)" className="bg-slate-900 border-slate-700 text-xs" />
          <Input value={filterMinCapacity} onChange={(e) => setFilterMinCapacity(e.target.value)} placeholder="Min capacity" className="bg-slate-900 border-slate-700 text-xs" />
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-end">
          <select
            value={selectedBreakdownLocationId}
            onChange={(e) => setSelectedBreakdownLocationId(e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={selectedListingId}
            onChange={(e) => setSelectedListingId(e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"
          >
            <option value="">Select listing to link</option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.name} · {listing.city ?? "Unknown city"}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-xs"
            disabled={!selectedBreakdownLocationId || !selectedListingId || assignLocationMutation.isPending}
            onClick={() =>
              assignLocationMutation.mutate({
                locationId: selectedBreakdownLocationId,
                listingId: selectedListingId,
              })
            }
          >
            Link listing to breakdown location
          </Button>
        </div>
        <h3 className="text-sm font-semibold text-white">Marketplace listings</h3>
        <p className="text-xs text-slate-500">
          Rates appear when you open a listing. Send a free request, message the owner anytime, and pay once approved.
        </p>
        <LocationMarketplaceCatalog
          listings={listings}
          isLoading={isListingsLoading}
          projectId={projectId}
          projectTitle={title}
          compact
          onRequestSuccess={setPortalMessage}
        />
      </div>
      <Link
        href={projectId ? `/creator/locations?projectId=${encodeURIComponent(projectId)}` : "/creator/locations"}
        className="creator-glass-panel p-4 transition hover:border-orange-400/35 block"
      >
        <h3 className="text-sm font-semibold text-white mb-1">Open Locations</h3>
        <p className="text-xs text-slate-400">Discover, request, and confirm locations with full messaging history.</p>
      </Link>
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
  const [hubMessage, setHubMessage] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["project-funding", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/funding`),
    enabled: hasProject,
  });
  const { data: budgetData } = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/budget`),
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
  const profile = data?.projectFundingProfile as
    | {
        budgetTotal: number;
        fundingRequired: number;
        fundingSecured: number;
        fundingReceived: number;
        fundingGap: number;
        percentFunded: number;
        allocationTotal: number;
        overspendRisk: boolean;
        status: string;
        minimumStartThresholdPercent: number;
        productionStartAllowed: boolean;
        scheduleGateReason: string | null;
      }
    | undefined;
  const readiness = data?.readiness as
    | {
        score: number;
        breakdown: {
          scriptReadiness: number;
          budgetReadiness: number;
          teamReadiness: number;
          scheduleReadiness: number;
        };
      }
    | undefined;
  const opportunities = useMemo(
    () =>
      ((data?.opportunities ?? []) as Array<{
        id: string;
        name: string;
        type: "INSTITUTIONAL" | "PRIVATE" | "INTERNAL_STORYTIME";
        description: string;
        categories: string[];
        minAmount: number;
        maxAmount: number;
        requirements: string[];
        applicationDeadline: string | null;
        contact: string;
        region: string | null;
        matchScore: number;
        sponsorName?: string;
      }>),
    [data?.opportunities],
  );
  const marketplaceOpportunities = (data?.marketplaceOpportunities ?? []) as Array<{
    id: string;
    title: string;
    marketCategory: string;
    fundingTarget: number;
    status: string;
  }>;
  const applications = (data?.applications ?? []) as Array<{
    id: string;
    opportunityId: string;
    funderName: string;
    funderType: string;
    requestedAmount: number;
    status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    submittedAt: string;
    documents: {
      pitchDeck: boolean;
      script: boolean;
      budget: boolean;
      productionPlan: boolean;
      teamDetails: boolean;
    };
    notes?: string | null;
  }>;
  const sources = useMemo(
    () =>
      ((data?.sources ?? []) as Array<{
        id: string;
        name: string;
        type: "INSTITUTIONAL" | "PRIVATE" | "INTERNAL_STORYTIME";
        instrument: "GRANT" | "EQUITY" | "LOAN" | "SPONSORSHIP" | "SELF_FUNDED";
        amountCommitted: number;
        amountReceived: number;
        paymentSchedule?: string | null;
        conditions?: string | null;
        linkedContractId?: string | null;
        status: "COMMITTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "ON_HOLD";
        notes?: string | null;
        milestones: Array<{
          id: string;
          phase: "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "DELIVERY";
          dueDate?: string | null;
          amount: number;
          paid: boolean;
          paidAt?: string | null;
          note?: string | null;
        }>;
      }>),
    [data?.sources],
  );
  const allocations = (data?.allocations ?? []) as Array<{
    id: string;
    department: string;
    amount: number;
    note?: string | null;
  }>;
  const milestoneAlerts = (data?.milestoneAlerts ?? []) as Array<{
    sourceId: string;
    sourceName: string;
    milestoneId: string;
    phase: string;
    amount: number;
    dueDate: string;
    alert: "MISSED" | "UPCOMING";
    deltaDays: number;
  }>;

  const [option, setOption] = useState<"HAS_FUNDING" | "REQUEST_FUNDING">("HAS_FUNDING");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [applicationNotes, setApplicationNotes] = useState("");
  const [listingTeaserTitle, setListingTeaserTitle] = useState("");
  const [listingTeaserLogline, setListingTeaserLogline] = useState("");
  const [listingTeaserGenre, setListingTeaserGenre] = useState("");
  const [listingFormat, setListingFormat] = useState("FEATURE");
  const [listingBudgetBand, setListingBudgetBand] = useState("");
  const [listingStage, setListingStage] = useState("Pre-production");
  const [listingTerritory, setListingTerritory] = useState("");
  const [listingUseOfFunds, setListingUseOfFunds] = useState("");
  const [listingRevenueModel, setListingRevenueModel] = useState("");
  const [listingTeamCred, setListingTeamCred] = useState("");
  const [listingEquityPct, setListingEquityPct] = useState("");
  const [listingFundingTarget, setListingFundingTarget] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<"INSTITUTIONAL" | "PRIVATE" | "INTERNAL_STORYTIME">(
    "PRIVATE",
  );
  const [sourceInstrument, setSourceInstrument] = useState<"GRANT" | "EQUITY" | "LOAN" | "SPONSORSHIP" | "SELF_FUNDED">(
    "GRANT",
  );
  const [sourceCommitted, setSourceCommitted] = useState("");
  const [sourceReceived, setSourceReceived] = useState("");
  const [sourcePaymentSchedule, setSourcePaymentSchedule] = useState("");
  const [sourceConditions, setSourceConditions] = useState("");
  const [allocationDepartment, setAllocationDepartment] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationNote, setAllocationNote] = useState("");
  const [thresholdPercent, setThresholdPercent] = useState("35");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [milestonePhase, setMilestonePhase] = useState<"PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "DELIVERY">("PRE_PRODUCTION");
  const [milestoneAmount, setMilestoneAmount] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");

  const budgetTotal =
    typeof budgetData?.total === "number"
      ? budgetData.total
      : Array.isArray(budgetData?.lines)
      ? (budgetData.lines as { total: number }[]).reduce((sum, l) => sum + (l.total || 0), 0)
      : profile?.budgetTotal ?? null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_SNAPSHOT",
          option,
          amount: amount ? Number(amount) : null,
          currency: "ZAR",
          details: details || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] });
      setHubMessage("Funding snapshot saved.");
    },
  });
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOpportunityId) throw new Error("Select a funding opportunity");
      const opportunity = opportunities.find((o) => o.id === selectedOpportunityId);
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_APPLICATION",
          application: {
            opportunityId: selectedOpportunityId,
            funderName: opportunity?.sponsorName ?? opportunity?.name ?? "Funding program",
            funderType: opportunity?.type ?? "INSTITUTIONAL",
            requestedAmount: Number(requestedAmount || "0"),
            notes: applicationNotes || null,
            documents: {
              pitchDeck: false,
              script: true,
              budget: budgetTotal != null,
              productionPlan: true,
              teamDetails: true,
            },
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to submit application");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] });
      setApplicationNotes("");
      setRequestedAmount("");
      setHubMessage("Funding application submitted.");
    },
  });
  const addSourceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_SOURCE",
          source: {
            name: sourceName,
            type: sourceType,
            instrument: sourceInstrument,
            amountCommitted: Number(sourceCommitted || "0"),
            amountReceived: Number(sourceReceived || "0"),
            paymentSchedule: sourcePaymentSchedule || null,
            conditions: sourceConditions || null,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to add funding source");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] });
      setSourceName("");
      setSourceCommitted("");
      setSourceReceived("");
      setSourcePaymentSchedule("");
      setSourceConditions("");
      setHubMessage("Funding source recorded.");
    },
  });
  const publishOpportunityMutation = useMutation({
    mutationFn: async () => {
      const target = Number(listingFundingTarget || requestedAmount || amount || "0");
      const res = await fetch("/api/funders/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type: "FILM_PROJECT",
          marketCategory: "FILM_PROJECT",
          title: listingTeaserTitle || `${title} — funding opportunity`,
          description: listingUseOfFunds || applicationNotes || "Creator-published funding opportunity.",
          fundingTarget: target > 0 ? target : 1,
          equityOfferedPct: listingEquityPct ? Number(listingEquityPct) : null,
          revenueModel: listingRevenueModel || null,
          termsSummary: listingRevenueModel || null,
          publicListingMeta: {
            teaserTitle: listingTeaserTitle || `${title} production`,
            teaserLogline: listingTeaserLogline || null,
            teaserGenre: listingTeaserGenre || null,
            teaserFormat: listingFormat,
            budgetBand: listingBudgetBand || (target > 0 ? `~R${Math.round(target).toLocaleString()}` : null),
            stage: listingStage,
            territory: listingTerritory || null,
            useOfFundsSummary: listingUseOfFunds || null,
            revenueModelSummary: listingRevenueModel || null,
            teamCredibility: listingTeamCred || null,
            lockedUntilInterest: true,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to publish listing");
      return res.json();
    },
    onSuccess: () => {
      setHubMessage("Privacy-safe listing published to the funder marketplace. Full project details unlock when a funder expresses interest.");
      queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] });
    },
  });
  const addAllocationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ALLOCATION",
          allocation: {
            department: allocationDepartment,
            amount: Number(allocationAmount || "0"),
            note: allocationNote || null,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to add allocation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] });
      setAllocationDepartment("");
      setAllocationAmount("");
      setAllocationNote("");
      setHubMessage("Department allocation added.");
    },
  });
  const appStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_APPLICATION",
          application: { id, status },
        }),
      });
      if (!res.ok) throw new Error("Failed to update application status");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] }),
  });
  const sourceMutation = useMutation({
    mutationFn: async ({
      id,
      amountReceived,
      milestones,
      makeContract,
    }: {
      id: string;
      amountReceived?: number;
      milestones?: Array<{
        id: string;
        phase: "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "DELIVERY";
        dueDate?: string | null;
        amount: number;
        paid: boolean;
        paidAt?: string | null;
        note?: string | null;
      }>;
      makeContract?: boolean;
    }) => {
      if (makeContract) {
        const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "LINK_SOURCE_CONTRACT",
            contractForSourceId: id,
          }),
        });
        if (!res.ok) throw new Error("Failed to create funding contract");
        return res.json();
      }
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_SOURCE",
          source: {
            id,
            amountReceived,
            milestones,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to update funding source");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] });
      setHubMessage("Funding source updated.");
    },
  });
  const settingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/funding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_SETTINGS",
          settings: {
            minimumStartThresholdPercent: Number(thresholdPercent || "35"),
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to update funding settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-funding", projectId] });
      setHubMessage("Funding settings saved.");
    },
  });

  useEffect(() => {
    if (funding) {
      setOption(funding.option as "HAS_FUNDING" | "REQUEST_FUNDING");
      setAmount(funding.amount != null ? String(funding.amount) : "");
      setDetails(funding.details ?? "");
      if (profile?.minimumStartThresholdPercent != null) {
        setThresholdPercent(String(profile.minimumStartThresholdPercent));
      }
    }
  }, [funding, profile?.minimumStartThresholdPercent]);
  useEffect(() => {
    if (!selectedOpportunityId && opportunities.length > 0) {
      setSelectedOpportunityId(opportunities[0].id);
    }
  }, [selectedOpportunityId, opportunities]);
  useEffect(() => {
    if (!selectedSourceId && sources.length > 0) {
      setSelectedSourceId(sources[0].id);
    }
  }, [selectedSourceId, sources]);

  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null;

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
              Marketplace-style funding command center for institutional, private, and Story Time funding with
              application tracking, milestone payouts, contract links, and execution gating.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            
          </div>
        </div>
      </header>
      
      {hubMessage ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {hubMessage}
        </p>
      ) : null}

      {hasProject && profile && (
        <div className="grid gap-2 md:grid-cols-4">
          <div className="creator-glass-panel p-3">
            <p className="text-xs text-slate-400">Funding secured</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{formatZar(profile.fundingSecured, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="creator-glass-panel p-3">
            <p className="text-xs text-slate-400">Funding gap</p>
            <p className="mt-1 text-xl font-semibold text-amber-300">{formatZar(profile.fundingGap, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="creator-glass-panel p-3">
            <p className="text-xs text-slate-400">Coverage</p>
            <p className="mt-1 text-xl font-semibold text-white">{profile.percentFunded}%</p>
          </div>
          <div className="creator-glass-panel p-3">
            <p className="text-xs text-slate-400">Readiness score</p>
            <p className="mt-1 text-xl font-semibold text-cyan-300">{readiness?.score ?? 0}/100</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 bg-slate-800/60" />
      ) : (
        <div className="space-y-4">
          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Project funding profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Funding mode</label>
                  <select
                    value={option}
                    onChange={(e) => setOption(e.target.value as "HAS_FUNDING" | "REQUEST_FUNDING")}
                    className="h-10 w-full rounded-md bg-slate-900 border border-slate-700 px-3 text-sm text-white"
                  >
                    <option value="HAS_FUNDING">Already funded / mixed</option>
                    <option value="REQUEST_FUNDING">Seeking funding</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Headline amount (ZAR)</label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Minimum start threshold (%)</label>
                  <Input
                    type="number"
                    value={thresholdPercent}
                    onChange={(e) => setThresholdPercent(e.target.value)}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
              </div>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
                placeholder="Funding strategy, conditions, investor context..."
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasProject}>
                  Save profile
                </Button>
                <Button size="sm" variant="outline" className="border-slate-700 text-xs" onClick={() => settingsMutation.mutate()} disabled={settingsMutation.isPending || !hasProject}>
                  Save threshold
                </Button>
                {profile?.scheduleGateReason ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-200">
                    {profile.scheduleGateReason}
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                    Production threshold met
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Funder marketplace & applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] text-slate-400">
                Apply to programs published by Story Time admin and verified funders. Your full script and budget are not shared until a program owner reviews your application.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {opportunities.length === 0 ? (
                    <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-500">
                      No funding programs are open right now. Story Time admin and verified funders publish programs from their dashboards — check back soon or publish your project to the marketplace below.
                    </p>
                  ) : null}
                  {opportunities.map((opp) => (
                    <div key={opp.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-100 font-medium">{opp.name}</p>
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                          Match {opp.matchScore}%
                        </span>
                      </div>
                      <p className="text-slate-400">{opp.description}</p>
                      <p className="text-slate-500">
                        {opp.type.replaceAll("_", " ")} · {formatZar(opp.minAmount, { maximumFractionDigits: 0 })} - {formatZar(opp.maxAmount, { maximumFractionDigits: 0 })}
                        {opp.applicationDeadline ? ` · Deadline ${new Date(opp.applicationDeadline).toLocaleDateString()}` : ""}
                      </p>
                      <Button
                        size="sm"
                        variant={selectedOpportunityId === opp.id ? "default" : "outline"}
                        className={selectedOpportunityId === opp.id ? "h-6 bg-orange-500 hover:bg-orange-600 text-[10px]" : "h-6 border-slate-700 text-[10px]"}
                        onClick={() => setSelectedOpportunityId(opp.id)}
                      >
                        {selectedOpportunityId === opp.id ? "Selected" : "Select"}
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Input
                    type="number"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder="Requested amount (ZAR)"
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                  <textarea
                    value={applicationNotes}
                    onChange={(e) => setApplicationNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
                    placeholder="Application notes and positioning..."
                  />
                  <p className="text-[11px] text-slate-500">
                    Package checks: Pitch deck {applications.some((app) => app.documents.pitchDeck) ? "Yes" : "No"} · Budget {budgetTotal != null ? "Yes" : "No"} · Script Yes · Plan Yes · Team Yes
                  </p>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                    onClick={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending || !selectedOpportunityId}
                  >
                    Submit application
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white">Application tracker</p>
                {applications.length === 0 ? (
                  <p className="text-xs text-slate-500">No applications yet.</p>
                ) : (
                  applications.map((app) => (
                    <div key={app.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs flex items-center justify-between gap-2">
                      <div>
                        <p className="text-slate-100">{app.funderName}</p>
                        <p className="text-slate-500">
                          {formatZar(app.requestedAmount, { maximumFractionDigits: 0 })} · {app.status} · {new Date(app.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <select
                        value={app.status}
                        onChange={(e) => appStatusMutation.mutate({ id: app.id, status: e.target.value })}
                        className="h-8 rounded-md bg-slate-900 border border-slate-700 px-2 text-[11px] text-white"
                      >
                        <option value="SUBMITTED">Submitted</option>
                        <option value="UNDER_REVIEW">Under review</option>
                        <option value="CHANGES_REQUESTED">Changes requested</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Funding sources, milestones, and contracts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-3">
                <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Investor / funder name" className="bg-slate-900 border-slate-700 text-xs" />
                <select value={sourceType} onChange={(e) => setSourceType(e.target.value as any)} className="h-10 rounded-md bg-slate-900 border border-slate-700 px-3 text-xs text-white">
                  <option value="INSTITUTIONAL">Institutional</option>
                  <option value="PRIVATE">Private / External</option>
                  <option value="INTERNAL_STORYTIME">Story Time Internal</option>
                </select>
                <select value={sourceInstrument} onChange={(e) => setSourceInstrument(e.target.value as any)} className="h-10 rounded-md bg-slate-900 border border-slate-700 px-3 text-xs text-white">
                  <option value="GRANT">Grant</option>
                  <option value="EQUITY">Equity</option>
                  <option value="LOAN">Loan</option>
                  <option value="SPONSORSHIP">Sponsorship</option>
                  <option value="SELF_FUNDED">Self-funded</option>
                </select>
                <Input type="number" value={sourceCommitted} onChange={(e) => setSourceCommitted(e.target.value)} placeholder="Committed amount" className="bg-slate-900 border-slate-700 text-xs" />
                <Input type="number" value={sourceReceived} onChange={(e) => setSourceReceived(e.target.value)} placeholder="Received amount" className="bg-slate-900 border-slate-700 text-xs" />
                <Input value={sourcePaymentSchedule} onChange={(e) => setSourcePaymentSchedule(e.target.value)} placeholder="Payment schedule / milestones" className="bg-slate-900 border-slate-700 text-xs" />
              </div>
              <textarea value={sourceConditions} onChange={(e) => setSourceConditions(e.target.value)} rows={2} className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white" placeholder="Conditions, obligations, recoupment terms..." />
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs" onClick={() => addSourceMutation.mutate()} disabled={addSourceMutation.isPending || !sourceName.trim()}>
                Record funding source
              </Button>

              <div className="space-y-2">
                {sources.length === 0 ? (
                  <p className="text-xs text-slate-500">No funding sources recorded yet.</p>
                ) : (
                  sources.map((src) => (
                    <div key={src.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-100 font-medium">{src.name}</p>
                        <p className="text-slate-400">{src.status}</p>
                      </div>
                      <p className="text-slate-500">
                        {src.type.replaceAll("_", " ")} · {src.instrument} · Committed {formatZar(src.amountCommitted, { maximumFractionDigits: 0 })} · Received {formatZar(src.amountReceived, { maximumFractionDigits: 0 })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 border-slate-700 px-2 text-[10px]"
                          onClick={() => {
                            const nextReceived = Number(window.prompt("Update received amount", String(src.amountReceived)) || src.amountReceived);
                            sourceMutation.mutate({ id: src.id, amountReceived: nextReceived });
                          }}
                        >
                          Update received
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 border-emerald-600/60 px-2 text-[10px] text-emerald-200"
                          onClick={() => sourceMutation.mutate({ id: src.id, makeContract: true })}
                          disabled={sourceMutation.isPending || !!src.linkedContractId}
                        >
                          {src.linkedContractId ? "Contract linked" : "Generate funding contract"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <select value={selectedSourceId} onChange={(e) => setSelectedSourceId(e.target.value)} className="h-10 rounded-md bg-slate-900 border border-slate-700 px-3 text-xs text-white">
                  {sources.length === 0 ? <option value="">No source selected</option> : sources.map((src) => <option key={src.id} value={src.id}>{src.name}</option>)}
                </select>
                <select value={milestonePhase} onChange={(e) => setMilestonePhase(e.target.value as any)} className="h-10 rounded-md bg-slate-900 border border-slate-700 px-3 text-xs text-white">
                  <option value="PRE_PRODUCTION">Pre-production</option>
                  <option value="PRODUCTION">Production</option>
                  <option value="POST_PRODUCTION">Post-production</option>
                  <option value="DELIVERY">Delivery</option>
                </select>
                <Input type="number" value={milestoneAmount} onChange={(e) => setMilestoneAmount(e.target.value)} placeholder="Milestone amount" className="bg-slate-900 border-slate-700 text-xs" />
                <Input type="date" value={milestoneDueDate} onChange={(e) => setMilestoneDueDate(e.target.value)} className="bg-slate-900 border-slate-700 text-xs" />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-xs"
                disabled={!selectedSource || !milestoneAmount}
                onClick={() => {
                  if (!selectedSource) return;
                  const nextMilestones = [
                    ...(selectedSource.milestones ?? []),
                    {
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      phase: milestonePhase,
                      dueDate: milestoneDueDate || null,
                      amount: Number(milestoneAmount || "0"),
                      paid: false,
                      paidAt: null,
                      note: null,
                    },
                  ];
                  sourceMutation.mutate({ id: selectedSource.id, milestones: nextMilestones });
                  setMilestoneAmount("");
                  setMilestoneDueDate("");
                }}
              >
                Add payout milestone
              </Button>

              {milestoneAlerts.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                  {milestoneAlerts.slice(0, 6).map((alert) => (
                    <p key={alert.milestoneId}>
                      {alert.alert === "MISSED" ? "Missed" : "Upcoming"} payout · {alert.sourceName} · {alert.phase} · {formatZar(alert.amount, { maximumFractionDigits: 0 })} · {new Date(alert.dueDate).toLocaleDateString()}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Budget allocations & execution links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <Input value={allocationDepartment} onChange={(e) => setAllocationDepartment(e.target.value)} placeholder="Department (Camera, Cast, etc.)" className="bg-slate-900 border-slate-700 text-xs" />
                <Input type="number" value={allocationAmount} onChange={(e) => setAllocationAmount(e.target.value)} placeholder="Allocation amount" className="bg-slate-900 border-slate-700 text-xs" />
                <Input value={allocationNote} onChange={(e) => setAllocationNote(e.target.value)} placeholder="Allocation note" className="bg-slate-900 border-slate-700 text-xs" />
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs" onClick={() => addAllocationMutation.mutate()} disabled={addAllocationMutation.isPending || !allocationDepartment || !allocationAmount}>
                  Allocate
                </Button>
              </div>
              {profile?.overspendRisk ? (
                <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  Allocations exceed secured funding. Adjust allocations or secure additional funding.
                </p>
              ) : null}
              {allocations.length === 0 ? (
                <p className="text-xs text-slate-500">No allocations yet.</p>
              ) : (
                <div className="space-y-1">
                  {allocations.map((alloc) => (
                    <div key={alloc.id} className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs flex items-center justify-between">
                      <span className="text-slate-200">{alloc.department}</span>
                      <span className="text-slate-400">{formatZar(alloc.amount, { maximumFractionDigits: 0 })} {alloc.note ? `· ${alloc.note}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <Link href={projectId ? `/creator/projects/${projectId}/pre-production/budget-builder` : "/creator/pre/budget-builder"} className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 hover:border-orange-500/70 hover:text-orange-300 text-slate-300">
                  Open Budget Builder
                </Link>
                <Link href={projectId ? `/creator/projects/${projectId}/pre-production/legal-contracts` : "/creator/pre/legal-contracts"} className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 hover:border-orange-500/70 hover:text-orange-300 text-slate-300">
                  Open Legal & Contracts
                </Link>
                <Link href={projectId ? `/creator/projects/${projectId}/pre-production/production-scheduling` : "/creator/pre/production-scheduling"} className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 hover:border-orange-500/70 hover:text-orange-300 text-slate-300">
                  Open Production Scheduling
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Publish to funder marketplace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] text-slate-400">
                List your project for verified funders using a privacy-safe teaser only. Full script, budget, and cast details unlock after a funder expresses interest and you enter a deal room. Payments run through Story Time with platform fees included at checkout.
              </p>
              {marketplaceOpportunities.length > 0 && (
                <p className="text-xs text-emerald-300">
                  {marketplaceOpportunities.length} active listing(s) on the marketplace for this project.
                </p>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={listingTeaserTitle} onChange={(e) => setListingTeaserTitle(e.target.value)} placeholder="Public title (no spoilers)" className="bg-slate-900 border-slate-700 text-xs" />
                <select value={listingFormat} onChange={(e) => setListingFormat(e.target.value)} className="h-10 rounded-md bg-slate-900 border border-slate-700 px-3 text-xs text-white">
                  <option value="FEATURE">Feature</option>
                  <option value="SHORT_FILM">Short film</option>
                  <option value="SERIES">Series</option>
                  <option value="DOCUMENTARY">Documentary</option>
                </select>
                <Input value={listingTeaserGenre} onChange={(e) => setListingTeaserGenre(e.target.value)} placeholder="Genre" className="bg-slate-900 border-slate-700 text-xs" />
                <Input value={listingBudgetBand} onChange={(e) => setListingBudgetBand(e.target.value)} placeholder="Budget band (e.g. R2M–R5M)" className="bg-slate-900 border-slate-700 text-xs" />
                <Input type="number" value={listingFundingTarget} onChange={(e) => setListingFundingTarget(e.target.value)} placeholder="Funding target (ZAR)" className="bg-slate-900 border-slate-700 text-xs" />
                <Input value={listingEquityPct} onChange={(e) => setListingEquityPct(e.target.value)} placeholder="Equity offered %" className="bg-slate-900 border-slate-700 text-xs" />
                <Input value={listingTerritory} onChange={(e) => setListingTerritory(e.target.value)} placeholder="Territory / region" className="bg-slate-900 border-slate-700 text-xs" />
                <Input value={listingStage} onChange={(e) => setListingStage(e.target.value)} placeholder="Production stage" className="bg-slate-900 border-slate-700 text-xs" />
              </div>
              <textarea value={listingTeaserLogline} onChange={(e) => setListingTeaserLogline(e.target.value)} rows={2} placeholder="One-line logline (no character names or plot spoilers)" className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white" />
              <textarea value={listingUseOfFunds} onChange={(e) => setListingUseOfFunds(e.target.value)} rows={2} placeholder="Use of funds summary" className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white" />
              <textarea value={listingTeamCred} onChange={(e) => setListingTeamCred(e.target.value)} rows={2} placeholder="Team credibility (credits, awards — no private contacts)" className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white" />
              <Input value={listingRevenueModel} onChange={(e) => setListingRevenueModel(e.target.value)} placeholder="Revenue / recoupment model summary" className="bg-slate-900 border-slate-700 text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-xs"
                  onClick={() => publishOpportunityMutation.mutate()}
                  disabled={publishOpportunityMutation.isPending}
                >
                  {publishOpportunityMutation.isPending ? "Publishing…" : "Publish privacy-safe listing"}
                </Button>
                <Link href={projectId ? `/creator/projects/${projectId}/pre-production/legal-contracts` : "/creator/pre/legal-contracts"} className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-orange-500/70 hover:text-orange-300">
                  Link funding contracts
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hasProject && profile && (
        <div className="creator-glass-panel p-4 text-xs space-y-1">
          <p className="text-slate-200 font-medium">Project funding status: {profile.status.replaceAll("_", " ")}</p>
          <p className="text-slate-400">
            Budget: {formatZar(profile.budgetTotal, { maximumFractionDigits: 0 })} · Secured: {formatZar(profile.fundingSecured, { maximumFractionDigits: 0 })} · Received: {formatZar(profile.fundingReceived, { maximumFractionDigits: 0 })} · Gap: {formatZar(profile.fundingGap, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-slate-500">
            Investor view: {sources.length} source(s), {applications.length} application(s), {milestoneAlerts.length} payout alert(s).
          </p>
        </div>
      )}

      {hasProject && !budgetTotal ? (
        <div className="creator-glass-panel p-3 text-xs text-amber-200 border border-amber-500/30">
          Budget is not set. Funding gap and eligibility will be more accurate after Budget Builder is completed.
        </div>
      ) : null}

      {false && (
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardContent />
        </Card>
      )}
    </div>
  );
}

/* Pitch Deck Builder removed.
function PitchDeckWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const { data, isLoading } = useQuery({
    queryKey: ["project-pitch-deck", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/pitch-deck`),
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
            
            <span className="text-xs leading-relaxed text-slate-400">
              Keep this in sync with your script, budget, and funding plan – it&apos;s the version of the story you share with partners.
            </span>
          </div>
        </div>
      </header>
      

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
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedSlideId(s.id);
                      setEditingTitle(s.title ?? "");
                      setEditingBody(s.body ?? "");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedSlideId(s.id);
                        setEditingTitle(s.title ?? "");
                        setEditingBody(s.body ?? "");
                      }
                    }}
                    className={[
                      "w-full cursor-pointer text-left rounded-xl px-3 py-2 text-xs border transition focus:outline-none focus:ring-2 focus:ring-orange-500/60",
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
                  </div>
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
*/

// --- Table Reads ---
function tableReadDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tableReadDatetimeLocalToIso(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type TableReadSessionRow = {
  id: string;
  name: string | null;
  scheduledAt: string | null;
  notesLog: string | null;
  createdAt: string;
  participants: {
    id: string;
    userId: string | null;
    guestName: string | null;
    user: { id: string; name: string | null; email: string | null } | null;
    characterName: string | null;
  }[];
  notes: {
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string | null; email: string | null } | null;
  }[];
};

function tableReadParticipantLabel(p: TableReadSessionRow["participants"][0]): string {
  return p.guestName?.trim() || p.user?.name || p.user?.email || "Attendee";
}

function TableReadSessionEditor({
  session,
  projectId,
}: {
  session: TableReadSessionRow;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const lastSavedLogRef = useRef(session.notesLog ?? "");
  const [name, setName] = useState(session.name ?? "");
  const [scheduledLocal, setScheduledLocal] = useState(tableReadDatetimeLocalValue(session.scheduledAt));
  const [notesLog, setNotesLog] = useState(session.notesLog ?? "");
  const [addNoteBody, setAddNoteBody] = useState("");
  const [newAttendeeName, setNewAttendeeName] = useState("");
  const [newAttendeeChar, setNewAttendeeChar] = useState("");
  const [saveHint, setSaveHint] = useState("");

  useEffect(() => {
    setName(session.name ?? "");
    setScheduledLocal(tableReadDatetimeLocalValue(session.scheduledAt));
    setNotesLog(session.notesLog ?? "");
    lastSavedLogRef.current = session.notesLog ?? "";
  }, [session.id, session.name, session.notesLog, session.scheduledAt]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["project-table-reads", projectId] });
  };

  const patchSession = useMutation({
    mutationFn: async (payload: { name?: string | null; scheduledAt?: string | null; notesLog?: string | null }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/table-reads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, ...payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Save failed");
      return j;
    },
    onSuccess: () => {
      invalidate();
      setSaveHint("Saved");
      window.setTimeout(() => setSaveHint(""), 2000);
    },
    onError: () => setSaveHint("Could not save"),
  });

  const patchSessionMutateRef = useRef(patchSession.mutate);
  patchSessionMutateRef.current = patchSession.mutate;

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (notesLog === lastSavedLogRef.current) return;
      patchSessionMutateRef.current(
        { notesLog: notesLog.trim() ? notesLog : null },
        {
          onSuccess: () => {
            lastSavedLogRef.current = notesLog;
          },
        },
      );
    }, 900);
    return () => window.clearTimeout(t);
  }, [notesLog, session.id]);

  const addParticipantMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/table-reads/${session.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: newAttendeeName.trim(),
          characterName: newAttendeeChar.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not add attendee");
      return j;
    },
    onSuccess: () => {
      setNewAttendeeName("");
      setNewAttendeeChar("");
      invalidate();
    },
  });

  const patchParticipantMutation = useMutation({
    mutationFn: async (payload: { participantId: string; characterName?: string | null; guestName?: string | null }) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/table-reads/${session.id}/participants/${payload.participantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterName: payload.characterName,
            guestName: payload.guestName,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Update failed");
      return j;
    },
    onSuccess: invalidate,
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/table-reads/${session.id}/participants/${participantId}`,
        { method: "DELETE" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Remove failed");
      return j;
    },
    onSuccess: invalidate,
  });

  const appendNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/table-reads/${session.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not add note");
      return j;
    },
    onSuccess: () => {
      setAddNoteBody("");
      invalidate();
    },
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Session title</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim() || null;
              if (next === (session.name ?? null)) return;
              patchSession.mutate({ name: next });
            }}
            placeholder="e.g. Table read — draft 3"
            className="bg-slate-900 border-slate-700 text-sm"
          />
        </div>
        <div className="space-y-2 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Date & time</label>
          <Input
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            onBlur={() => {
              const iso = tableReadDatetimeLocalToIso(scheduledLocal);
              const prev = session.scheduledAt;
              if (iso === prev || (!iso && !prev)) return;
              patchSession.mutate({ scheduledAt: iso });
            }}
            className="bg-slate-900 border-slate-700 text-sm"
          />
        </div>
        {saveHint ? <span className="text-[11px] text-slate-500 self-end pb-1">{saveHint}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white">Attendees & character assignments</h4>
          <p className="text-[11px] text-slate-500">
            Add everyone at the read. List the part they played (character or role) so you remember who read what.
          </p>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 space-y-2">
            {session.participants.length === 0 ? (
              <p className="text-[11px] text-slate-500 px-1 py-2">No attendees yet — add names below.</p>
            ) : (
              <ul className="space-y-2">
                {session.participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 px-2 py-2"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {p.userId != null && p.userId !== "" ? (
                        <span className="text-[11px] text-slate-300 self-center">{tableReadParticipantLabel(p)}</span>
                      ) : (
                        <Input
                          key={`g-${p.id}`}
                          defaultValue={p.guestName ?? ""}
                          placeholder="Name"
                          className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v || v === (p.guestName ?? "")) return;
                            patchParticipantMutation.mutate({ participantId: p.id, guestName: v });
                          }}
                        />
                      )}
                      <Input
                        key={`c-${p.id}`}
                        defaultValue={p.characterName ?? ""}
                        placeholder="Character / part"
                        className="h-8 bg-slate-900 border-slate-700 text-[11px]"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v === (p.characterName ?? null)) return;
                          patchParticipantMutation.mutate({ participantId: p.id, characterName: v });
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[11px] text-red-300/90 hover:bg-red-500/10 shrink-0"
                      disabled={removeParticipantMutation.isPending}
                      onClick={() => {
                        if (!window.confirm("Remove this attendee from the session?")) return;
                        removeParticipantMutation.mutate(p.id);
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-slate-800">
              <Input
                value={newAttendeeName}
                onChange={(e) => setNewAttendeeName(e.target.value)}
                placeholder="Attendee name"
                className="h-8 bg-slate-900 border-slate-700 text-[11px] flex-1"
              />
              <Input
                value={newAttendeeChar}
                onChange={(e) => setNewAttendeeChar(e.target.value)}
                placeholder="Character (optional)"
                className="h-8 bg-slate-900 border-slate-700 text-[11px] flex-1"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-[11px] shrink-0"
                disabled={addParticipantMutation.isPending || !newAttendeeName.trim()}
                onClick={() => addParticipantMutation.mutate()}
              >
                Add attendee
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white">Session notes — what was said</h4>
          <p className="text-[11px] text-slate-500">
            Capture reactions, line tweaks, pacing, and performance notes. Saves automatically while you type.
          </p>
          <textarea
            value={notesLog}
            onChange={(e) => setNotesLog(e.target.value)}
            placeholder="e.g. Act 2 dragged — trim kitchen scene. Lisa nailed the reversal. Consider softer read on Kai’s last line…"
            rows={14}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-orange-500 resize-y min-h-[220px] leading-relaxed"
          />
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Timestamped highlights</p>
            <p className="text-[10px] text-slate-600">Optional short entries with time stamp (saved as separate notes).</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={addNoteBody}
                onChange={(e) => setAddNoteBody(e.target.value)}
                placeholder="Quick note…"
                className="h-8 bg-slate-950 border-slate-700 text-[11px] flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (addNoteBody.trim()) appendNoteMutation.mutate(addNoteBody.trim());
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-slate-600 text-[11px] shrink-0"
                disabled={appendNoteMutation.isPending || !addNoteBody.trim()}
                onClick={() => appendNoteMutation.mutate(addNoteBody.trim())}
              >
                Add note
              </Button>
            </div>
            {session.notes.length > 0 ? (
              <ul className="space-y-1.5 max-h-36 overflow-y-auto text-[11px] text-slate-300 pr-1">
                {session.notes.map((n) => (
                  <li key={n.id} className="rounded-md bg-slate-950/80 border border-slate-800/80 px-2 py-1.5">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {n.user?.name || "You"} · {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableReadsWorkspace({
  projectId,
  title,
}: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["project-table-reads", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/table-reads`),
    enabled: hasProject,
  });
  const sessions = useMemo(() => ((data?.sessions ?? []) as TableReadSessionRow[]), [data?.sessions]);

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
    if (activeSessionId && !sessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0]?.id ?? null);
    }
  }, [sessions, activeSessionId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/table-reads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New table read session" }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json() as Promise<{ session: TableReadSessionRow }>;
    },
    onSuccess: (out) => {
      void queryClient.invalidateQueries({ queryKey: ["project-table-reads", projectId] });
      if (out.session?.id) setActiveSessionId(out.session.id);
    },
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const [tableReadsViewOpen, setTableReadsViewOpen] = useState(false);

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
              Schedule table reads, list who attended and which characters they read, and keep a full running log of what was said —
              all editable here.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ToolViewButton
              onClick={() => setTableReadsViewOpen(true)}
              count={sessions.length}
              disabled={sessions.length === 0}
            />
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

      <ToolSavedViewSheet
        open={tableReadsViewOpen}
        onClose={() => setTableReadsViewOpen(false)}
        title="Table read sessions"
        subtitle="Saved sessions, schedules, and notes logs."
      >
        <TableReadsSavedViewer
          sessions={sessions.map((s) => ({
            id: s.id,
            name: s.name,
            scheduledAt: s.scheduledAt,
            notesLog: s.notesLog,
            participantCount: s.participants?.length ?? 0,
          }))}
        />
      </ToolSavedViewSheet>
      
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : !hasProject ? (
        <div className="creator-glass-panel p-4">
          <p className="text-xs text-slate-500">Link a project above to manage table reads.</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="creator-glass-panel p-4">
          <p className="text-xs text-slate-500">
            No table read sessions yet. Press <strong className="text-slate-400">New session</strong> to open an editable workspace
            for attendees and notes.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(200px,260px)_1fr]">
          <div className="creator-glass-panel p-3 space-y-2 h-fit lg:sticky lg:top-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sessions</p>
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActiveSessionId(s.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition ${
                      s.id === activeSessionId
                        ? "border-orange-500/60 bg-orange-500/10 text-white"
                        : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <span className="block font-medium truncate">{s.name || "Untitled session"}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : "No date set"} · {s.participants.length} attendees
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            {activeSession && projectId ? (
              <TableReadSessionEditor key={activeSession.id} session={activeSession} projectId={projectId} />
            ) : null}
          </div>
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
  const queryClient = useQueryClient();
  const hasProject = !!projectId;
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [filterDept, setFilterDept] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "COMPLETED">("ALL");
  const [filterSceneId, setFilterSceneId] = useState("");
  const [filterPriority, setFilterPriority] = useState<"ALL" | "LOW" | "MEDIUM" | "HIGH">("ALL");
  const [activeShootDayId, setActiveShootDayId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDepartment, setNewDepartment] = useState("Production");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newStatus, setNewStatus] = useState("TODO");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newShootDayId, setNewShootDayId] = useState("");
  const [newSceneId, setNewSceneId] = useState("");
  const [newLinkedType, setNewLinkedType] = useState<
    "OTHER" | "SCENE" | "PRODUCTION_DAY" | "CAST" | "CREW" | "LOCATION" | "EQUIPMENT" | "CONTRACT" | "FUNDING"
  >("OTHER");
  const [newLinkedLabel, setNewLinkedLabel] = useState("");
  const [selectedTaskIdForComment, setSelectedTaskIdForComment] = useState("");
  const [commentBody, setCommentBody] = useState("");

  const { data: workspaceData, isLoading: tasksLoading } = useQuery({
    queryKey: ["project-production-workspace", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/production-workspace`),
    enabled: hasProject,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/schedule`),
    enabled: hasProject,
  });
  const { data: scenesData } = useQuery({
    queryKey: ["project-scenes", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/scenes`),
    enabled: hasProject,
  });

  const overview = workspaceData?.projectOverview as
    | {
        projectStatus: string;
        fundingStatus: string;
        budgetStatus: { estimated: number; actual: number; variance: number };
        scheduleStatus: string;
        contractStatus: { confirmed: number; pending: number };
        keyAlerts: { type: string; severity: string; message: string; taskId?: string }[];
      }
    | undefined;
  const tasks = useMemo(
    () =>
      ((workspaceData?.tasks ?? []) as Array<{
        id: string;
        title: string;
        description: string | null;
        department: string | null;
        status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "COMPLETED";
        priority: "LOW" | "MEDIUM" | "HIGH" | null;
        dueDate: string | null;
        assigneeId: string | null;
        assignee?: { id: string; name: string | null; email: string | null; role: string } | null;
        shootDay?: { id: string; date: string; status: string } | null;
        scene?: { id: string; number: string; heading: string | null } | null;
        linkedItem?: { type: string | null; id: string | null; label: string | null };
        meta?: {
          comments?: Array<{ id: string; body: string; createdAt: string; mentions?: string[] }>;
          requireSignedContracts?: boolean;
          blockedReason?: string | null;
        };
      }>),
    [workspaceData?.tasks],
  );
  const taskSummary = workspaceData?.taskSummary as
    | {
        total: number;
        open: number;
        done: number;
        completionPercent: number;
        byDepartment: Array<{
          department: string;
          total: number;
          done: number;
          inProgress: number;
          blocked: number;
          todo: number;
          completionPercent: number;
        }>;
      }
    | undefined;
  const activityFeed = (workspaceData?.activityFeed ?? []) as Array<{
    id: string;
    type: string;
    message: string;
    user: { id: string; name: string | null; email: string | null } | null;
    createdAt: string;
  }>;
  const resourceStatus = workspaceData?.resourceStatus as
    | {
        cast: { confirmed: number; pending: number };
        crew: { assigned: number; available: number };
        locations: { booked: number; pending: number };
        equipment: { allocated: number; available: number };
      }
    | undefined;
  const integrations = workspaceData?.integrations as
    | {
        budget: { synced: boolean; estimated: number; actual: number };
        scheduling: { synced: boolean; dayCount: number; conflictCount: number };
        contracts: { pending: number; signed: number };
        funding: { secured: number; status: string };
      }
    | undefined;
  const teamMembers = useMemo(
    () =>
      ((workspaceData?.team?.members ?? []) as Array<{
        id: string;
        name: string | null;
        email: string | null;
        role: string;
        viewRole: string;
      }>),
    [workspaceData?.team?.members],
  );

  const shootDays = useMemo(
    () => ((scheduleData?.shootDays ?? []) as Array<{ id: string; date: string }>),
    [scheduleData?.shootDays],
  );
  const scenes = (scenesData?.scenes ?? []) as Array<{ id: string; number: string; heading: string | null }>;

  useEffect(() => {
    if (!activeShootDayId && shootDays.length > 0) {
      setActiveShootDayId(shootDays[0].id);
      setNewShootDayId(shootDays[0].id);
    }
  }, [activeShootDayId, shootDays]);

  useEffect(() => {
    if (!selectedTaskIdForComment && tasks.length > 0) {
      setSelectedTaskIdForComment(tasks[0].id);
    }
  }, [selectedTaskIdForComment, tasks]);
  useEffect(() => {
    if (!newAssigneeId && teamMembers.length > 0) {
      setNewAssigneeId(teamMembers[0].id);
    }
  }, [newAssigneeId, teamMembers]);

  const actionMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/creator/projects/${projectId}/production-workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Workspace action failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-production-workspace", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["production-control-center", projectId] });
      setWorkspaceMessage("Production workspace updated.");
    },
    onError: (e) => setWorkspaceMessage((e as Error).message),
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterDept && (task.department || "").toLowerCase() !== filterDept.toLowerCase()) return false;
      if (filterAssignee && task.assigneeId !== filterAssignee) return false;
      if (filterStatus !== "ALL" && task.status !== filterStatus) return false;
      if (filterSceneId && task.scene?.id !== filterSceneId) return false;
      if (filterPriority !== "ALL" && (task.priority || "MEDIUM") !== filterPriority) return false;
      if (activeShootDayId && task.shootDay?.id && task.shootDay.id !== activeShootDayId) return false;
      return true;
    });
  }, [tasks, filterAssignee, filterDept, filterStatus, filterSceneId, filterPriority, activeShootDayId]);

  const board = {
    todo: filteredTasks.filter((t) => t.status === "TODO"),
    inProgress: filteredTasks.filter((t) => t.status === "IN_PROGRESS"),
    blocked: filteredTasks.filter((t) => t.status === "BLOCKED"),
    done: filteredTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED"),
  };
  const selectedTaskForComment = tasks.find((t) => t.id === selectedTaskIdForComment) ?? null;

  const queueKey = useMemo(
    () => `storytime-onset-task-queue:${projectId ?? "unknown"}`,
    [projectId],
  );
  const enqueueOfflineUpdate = useCallback(
    (payload: Record<string, unknown>) => {
      try {
        const existing = JSON.parse(localStorage.getItem(queueKey) ?? "[]") as Array<Record<string, unknown>>;
        existing.push(payload);
        localStorage.setItem(queueKey, JSON.stringify(existing));
        setWorkspaceMessage("Offline: update queued and will sync when connection returns.");
      } catch {
        setWorkspaceMessage("Offline: could not queue update.");
      }
    },
    [queueKey],
  );

  const applyTaskUpdate = useCallback(
    (taskPayload: Record<string, unknown>) => {
      if (!navigator.onLine) {
        enqueueOfflineUpdate({ action: "UPDATE_TASK", task: taskPayload });
        return;
      }
      actionMutation.mutate({ action: "UPDATE_TASK", task: taskPayload });
    },
    [actionMutation, enqueueOfflineUpdate],
  );

  useEffect(() => {
    const flush = async () => {
      if (!navigator.onLine) return;
      let queue: Array<Record<string, unknown>> = [];
      try {
        queue = JSON.parse(localStorage.getItem(queueKey) ?? "[]");
      } catch {
        queue = [];
      }
      if (!Array.isArray(queue) || queue.length === 0) return;
      localStorage.removeItem(queueKey);
      for (const payload of queue) {
        try {
          await actionMutation.mutateAsync(payload);
        } catch {
          enqueueOfflineUpdate(payload);
          break;
        }
      }
      setWorkspaceMessage("Offline updates synced.");
    };
    window.addEventListener("online", flush);
    void flush();
    return () => window.removeEventListener("online", flush);
  }, [actionMutation, enqueueOfflineUpdate, queueKey]);

  const onDropToStatus = useCallback(
    (status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED", taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === status) return;
      if (status === "BLOCKED") {
        const reason = window.prompt("Why is this task blocked? (required)");
        if (!reason || !reason.trim()) return;
        applyTaskUpdate({ id: task.id, status, description: reason.trim() });
        return;
      }
      applyTaskUpdate({ id: task.id, status });
    },
    [tasks, applyTaskUpdate],
  );

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              On-set execution system
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Real-time Kanban for active production day execution. Tasks ingest from scheduling, script breakdown,
              equipment, locations, risk, and contracts, then sync back into control-center alerts.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-slate-600 text-slate-200 text-xs"
              onClick={() => actionMutation.mutate({ action: "AUTO_GENERATE_TASKS" })}
              disabled={actionMutation.isPending || !hasProject}
            >
              Sync tasks from all tools
            </Button>
            
          </div>
        </div>
      </header>
      
      {workspaceMessage && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {workspaceMessage}
        </p>
      )}
      {tasksLoading ? (
        <Skeleton className="h-64 bg-slate-800/60" />
      ) : (
        <div className="space-y-4">
          {overview && (
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
              <div className="creator-glass-panel p-3 text-xs">
                <p className="text-slate-400">Project status</p>
                <p className="text-white font-semibold mt-1">{overview.projectStatus}</p>
              </div>
              <div className="creator-glass-panel p-3 text-xs">
                <p className="text-slate-400">Funding</p>
                <p className="text-white font-semibold mt-1">{overview.fundingStatus}</p>
              </div>
              <div className="creator-glass-panel p-3 text-xs">
                <p className="text-slate-400">Budget</p>
                <p className="text-white font-semibold mt-1">
                  {formatZar(Math.round(overview.budgetStatus.actual), { maximumFractionDigits: 0 })} /{" "}
                  {formatZar(Math.round(overview.budgetStatus.estimated), { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="creator-glass-panel p-3 text-xs">
                <p className="text-slate-400">Schedule</p>
                <p className="text-white font-semibold mt-1">{overview.scheduleStatus}</p>
              </div>
              <div className="creator-glass-panel p-3 text-xs">
                <p className="text-slate-400">Contracts</p>
                <p className="text-white font-semibold mt-1">
                  {overview.contractStatus.confirmed} confirmed · {overview.contractStatus.pending} pending
                </p>
              </div>
              <div className="creator-glass-panel p-3 text-xs">
                <p className="text-slate-400">Task progress</p>
                <p className="text-white font-semibold mt-1">{taskSummary?.completionPercent ?? 0}% complete</p>
              </div>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Create production task</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Task title"
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={2}
                    placeholder="Description / context"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                  <div className="grid gap-2 md:grid-cols-4">
                    <select value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                      {["Production", "Camera", "Sound", "Art", "Wardrobe", "Post-production", "Logistics"].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                      {["LOW", "MEDIUM", "HIGH"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                      {["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                    </select>
                    <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="bg-slate-900 border-slate-700 text-xs" />
                    <select value={newAssigneeId} onChange={(e) => setNewAssigneeId(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                      {teamMembers.length === 0 ? <option value="">No assignee</option> : teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name || m.email || "Unnamed"}</option>)}
                    </select>
                    <select value={newShootDayId} onChange={(e) => setNewShootDayId(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                      <option value="">No shoot day</option>
                      {shootDays.map((d) => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()}</option>)}
                    </select>
                    <select value={newSceneId} onChange={(e) => setNewSceneId(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                      <option value="">No scene</option>
                      {scenes.map((s) => <option key={s.id} value={s.id}>Sc. {s.number} {s.heading ? `- ${s.heading.slice(0, 20)}` : ""}</option>)}
                    </select>
                    <select value={newLinkedType} onChange={(e) => setNewLinkedType(e.target.value as any)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                      {["OTHER", "SCENE", "PRODUCTION_DAY", "CAST", "CREW", "LOCATION", "EQUIPMENT", "CONTRACT", "FUNDING"].map((x) => (
                        <option key={x} value={x}>{x.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </div>
                  <Input value={newLinkedLabel} onChange={(e) => setNewLinkedLabel(e.target.value)} placeholder="Linked item label (optional)" className="bg-slate-900 border-slate-700 text-xs" />
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-xs"
                    disabled={actionMutation.isPending || !newTitle.trim() || !hasProject}
                    onClick={() =>
                      actionMutation.mutate({
                        action: "CREATE_TASK",
                        task: {
                          title: newTitle.trim(),
                          description: newDescription || null,
                          assigneeId: newAssigneeId || null,
                          department: newDepartment || null,
                          priority: newPriority,
                          status: newStatus,
                          dueDate: newDueDate ? new Date(`${newDueDate}T00:00:00.000Z`).toISOString() : null,
                          shootDayId: newShootDayId || null,
                          sceneId: newSceneId || null,
                          linkedItemType: newLinkedType,
                          linkedItemLabel: newLinkedLabel || null,
                          requireSignedContracts:
                            newLinkedType === "CAST" ||
                            newLinkedType === "CREW" ||
                            newLinkedType === "LOCATION" ||
                            newLinkedType === "EQUIPMENT",
                        },
                      })
                    }
                  >
                    Add task
                  </Button>
                </CardContent>
              </Card>

              <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Task controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={viewMode === "board" ? "default" : "outline"} className={viewMode === "board" ? "bg-orange-500 hover:bg-orange-600 text-xs" : "border-slate-700 text-xs"} onClick={() => setViewMode("board")}>
                      Kanban
                    </Button>
                    <Button size="sm" variant={viewMode === "list" ? "default" : "outline"} className={viewMode === "list" ? "bg-orange-500 hover:bg-orange-600 text-xs" : "border-slate-700 text-xs"} onClick={() => setViewMode("list")}>
                      List
                    </Button>
                    <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                      <option value="">All departments</option>
                      {(taskSummary?.byDepartment ?? []).map((d) => (
                        <option key={d.department} value={d.department}>{d.department} ({d.total})</option>
                      ))}
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                      <option value="ALL">All statuses</option>
                      <option value="TODO">Not started</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                    <select value={filterSceneId} onChange={(e) => setFilterSceneId(e.target.value)} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                      <option value="">All scenes</option>
                      {scenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>Scene {scene.number}</option>
                      ))}
                    </select>
                    <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as any)} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                      <option value="ALL">Any priority</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                    <select value={activeShootDayId} onChange={(e) => setActiveShootDayId(e.target.value)} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                      <option value="">All shoot days</option>
                      {shootDays.map((d) => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()}</option>)}
                    </select>
                    <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                      <option value="">All assignees</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>{member.name || member.email || "Unnamed"}</option>
                      ))}
                    </select>
                  </div>
                  {viewMode === "board" ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      {[
                        { key: "TODO", label: "To Do", tasks: board.todo, tone: "text-slate-300" },
                        { key: "IN_PROGRESS", label: "In Progress", tasks: board.inProgress, tone: "text-yellow-200" },
                        { key: "BLOCKED", label: "Blocked", tasks: board.blocked, tone: "text-red-300" },
                        { key: "COMPLETED", label: "Completed", tasks: board.done, tone: "text-emerald-300" },
                      ].map((col) => (
                        <div
                          key={col.key}
                          className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 space-y-2 min-h-[320px]"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const taskId = e.dataTransfer.getData("text/task-id");
                            if (taskId) {
                              onDropToStatus(col.key as "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED", taskId);
                            }
                          }}
                        >
                          <p className={`text-[11px] uppercase tracking-wide ${col.tone}`}>{col.label} ({col.tasks.length})</p>
                          {col.tasks.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
                              className={`rounded-lg border p-2 text-xs space-y-1 ${
                                task.status === "BLOCKED"
                                  ? "border-red-700/80 bg-red-950/30"
                                  : task.status === "IN_PROGRESS"
                                    ? "border-yellow-700/70 bg-yellow-950/20"
                                    : task.status === "COMPLETED" || task.status === "DONE"
                                      ? "border-emerald-700/70 bg-emerald-950/20"
                                      : "border-slate-800 bg-slate-950/60"
                              }`}
                            >
                              <p className="text-slate-100 font-medium">{task.title}</p>
                              {task.description ? <p className="text-slate-400">{task.description}</p> : null}
                              {task.meta?.blockedReason ? (
                                <p className="text-[10px] text-red-200">Blocked reason: {task.meta.blockedReason}</p>
                              ) : null}
                              <p className="text-slate-500">
                                {(task.department || "Production")} · {task.priority || "MEDIUM"}
                                {task.assignee ? ` · ${task.assignee.name || task.assignee.email}` : ""}
                              </p>
                              <p className="text-slate-600">
                                {task.scene ? `Sc. ${task.scene.number}` : ""}
                                {task.shootDay ? `${task.scene ? " · " : ""}${new Date(task.shootDay.date).toLocaleDateString()}` : ""}
                                {task.linkedItem?.label ? `${task.scene || task.shootDay ? " · " : ""}${task.linkedItem.label}` : ""}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {task.status !== "COMPLETED" && task.status !== "DONE" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 border-emerald-700/60 px-2 text-[10px] text-emerald-200"
                                    onClick={() => applyTaskUpdate({ id: task.id, status: "COMPLETED" })}
                                  >
                                    One-tap complete
                                  </Button>
                                ) : null}
                                {task.status !== "BLOCKED" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 border-red-700/60 px-2 text-[10px] text-red-200"
                                    onClick={() => {
                                      const reason = window.prompt("Block reason (required)");
                                      if (!reason?.trim()) return;
                                      applyTaskUpdate({ id: task.id, status: "BLOCKED", description: reason.trim() });
                                    }}
                                  >
                                    Mark blocked
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 border-cyan-600/60 px-2 text-[10px] text-cyan-200"
                                  onClick={() => setSelectedTaskIdForComment(task.id)}
                                >
                                  Comment
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredTasks.map((task) => (
                        <div key={task.id} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs flex items-center justify-between gap-2">
                          <div>
                            <p className="text-slate-100">{task.title}</p>
                            <p className="text-slate-500">
                              {task.status.replaceAll("_", " ")} · {(task.department || "Production")}
                              {task.assignee ? ` · ${task.assignee.name || task.assignee.email}` : ""}
                              {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
                            </p>
                          </div>
                          <select
                            value={task.status}
                            onChange={(e) =>
                              e.target.value === "BLOCKED"
                                ? (() => {
                                    const reason = window.prompt("Blocked reason (required)");
                                    if (!reason?.trim()) return;
                                    applyTaskUpdate({ id: task.id, status: "BLOCKED", description: reason.trim() });
                                  })()
                                : applyTaskUpdate({ id: task.id, status: e.target.value })
                            }
                            className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white"
                          >
                            <option value="TODO">Not started</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="BLOCKED">Blocked</option>
                            <option value="COMPLETED">Completed</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alerts & integrations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {(overview?.keyAlerts ?? []).length === 0 ? (
                    <p className="text-slate-500">No active alerts.</p>
                  ) : (
                    (overview?.keyAlerts ?? []).map((alert, idx) => (
                      <p key={`${alert.type}-${idx}`} className={alert.severity === "HIGH" ? "text-rose-200" : "text-amber-200"}>
                        [{alert.severity}] {alert.message}
                      </p>
                    ))
                  )}
                  {integrations && (
                    <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2 space-y-1">
                      <p className="text-slate-300">
                        Budget: {formatZar(Math.round(integrations.budget.actual), { maximumFractionDigits: 0 })} spent /{" "}
                        {formatZar(Math.round(integrations.budget.estimated), { maximumFractionDigits: 0 })} estimated
                      </p>
                      <p className="text-slate-300">
                        Schedule: {integrations.scheduling.dayCount} day(s) · {integrations.scheduling.conflictCount} conflict(s)
                      </p>
                      <p className="text-slate-300">
                        Contracts: {integrations.contracts.signed} signed · {integrations.contracts.pending} pending
                      </p>
                      <p className="text-slate-300">
                        Funding: {integrations.funding.status} · {formatZar(Math.round(integrations.funding.secured), { maximumFractionDigits: 0 })} secured
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Resource status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  <p className="text-slate-300">Cast: {resourceStatus?.cast.confirmed ?? 0} confirmed · {resourceStatus?.cast.pending ?? 0} pending</p>
                  <p className="text-slate-300">Crew: {resourceStatus?.crew.assigned ?? 0} assigned · {resourceStatus?.crew.available ?? 0} open</p>
                  <p className="text-slate-300">Locations: {resourceStatus?.locations.booked ?? 0} booked · {resourceStatus?.locations.pending ?? 0} pending</p>
                  <p className="text-slate-300">Equipment: {resourceStatus?.equipment.allocated ?? 0} allocated · {resourceStatus?.equipment.available ?? 0} available</p>
                </CardContent>
              </Card>

              <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Task discussion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <select
                    value={selectedTaskIdForComment}
                    onChange={(e) => setSelectedTaskIdForComment(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white"
                  >
                    {tasks.length === 0 ? <option value="">No task selected</option> : tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows={2}
                    placeholder="Comment on task (use @name for mentions)"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  />
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-xs"
                    disabled={!selectedTaskForComment || !commentBody.trim() || actionMutation.isPending}
                    onClick={() => {
                      if (!selectedTaskForComment) return;
                      actionMutation.mutate({
                        action: "ADD_TASK_COMMENT",
                        comment: { taskId: selectedTaskForComment.id, body: commentBody.trim() },
                      });
                      setCommentBody("");
                    }}
                  >
                    Add comment
                  </Button>
                  <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                    {(selectedTaskForComment?.meta?.comments ?? []).slice().reverse().slice(0, 10).map((comment) => (
                      <div key={comment.id} className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-[11px] text-slate-300">
                        <p>{comment.body}</p>
                        <p className="text-slate-500 mt-0.5">{new Date(comment.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Real-time activity feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {activityFeed.length === 0 ? (
                <p className="text-xs text-slate-500">No activity yet.</p>
              ) : (
                activityFeed.slice(0, 30).map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
                    <p className="text-slate-200">{item.message}</p>
                    <p className="text-slate-500">
                      {item.user?.name || item.user?.email || "System"} · {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {taskSummary?.byDepartment?.length ? (
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs font-medium text-slate-400">Department workload</p>
          <div className="grid gap-2 md:grid-cols-3">
            {taskSummary.byDepartment.map((dept) => (
              <div key={dept.department} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs">
                <p className="text-slate-200">{dept.department}</p>
                <p className="text-slate-500">
                  {dept.done}/{dept.total} done · {dept.inProgress} in progress · {dept.blocked} blocked · {dept.todo} todo
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${dept.completionPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
  const [portalMessage, setPortalMessage] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSpecs, setFilterSpecs] = useState("");

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filterCategory.trim()) params.set("category", filterCategory.trim());
    if (filterSpecs.trim()) params.set("specifications", filterSpecs.trim());
    const qs = params.toString();
    return qs
      ? `/api/creator/projects/${projectId}/equipment-plan?${qs}`
      : `/api/creator/projects/${projectId}/equipment-plan`;
  }, [projectId, filterCategory, filterSpecs]);

  const { data, isLoading } = useQuery({
    queryKey: ["project-equipment-plan", projectId, queryUrl],
    queryFn: projectToolQueryFn(queryUrl),
    enabled: hasProject,
  });
  const { data: scheduleData } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/schedule`),
    enabled: hasProject,
  });

  const items = useMemo(
    () =>
      ((data?.items ?? []) as Array<{
        id: string;
        category: string;
        quantity: number;
        description: string | null;
        equipmentListingId?: string | null;
        equipmentListing?: { id: string; companyName: string } | null;
      }>),
    [data?.items],
  );
  const marketplace = (data?.marketplace ?? []) as Array<{
    id: string;
    name: string;
    companyName: string;
    category: string;
    plainDescription?: string | null;
    location: string | null;
    previewImageUrl?: string | null;
    photos?: string[];
    company?: { id: string; name: string | null } | null;
    profile?: {
      specifications?: string | null;
      quantityAvailable?: number | null;
      availability?: string | null;
      galleryUrls?: string[];
    };
  }>;
  const conflicts = ((scheduleData?.conflicts ?? []) as Array<{ type: string; message: string }>).filter(
    (c) => c.type === "EQUIPMENT_CONFLICT",
  );
  const equipmentContext =
    items.length > 0
      ? items.map((i) => `${i.category} (qty: ${i.quantity})`).join("\n")
      : "No equipment plan items yet.";

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/equipment-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCategory || "Equipment",
          quantity: Number(newQuantity || "1"),
        }),
      });
      if (!res.ok) throw new Error("Failed to create item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment-plan", projectId] });
      invalidateProjectPipeline(queryClient, projectId, ["equipment"]);
      setNewCategory("");
      setNewQuantity("1");
      setPortalMessage("Equipment item created.");
    },
  });
  const linkListingMutation = useMutation({
    mutationFn: async () => {
      const item = items.find((i) => i.id === selectedItemId);
      if (!item || !selectedListingId) throw new Error("Select both item and listing");
      const res = await fetch(`/api/creator/projects/${projectId}/equipment-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          category: item.category,
          quantity: item.quantity,
          description: item.description,
          equipmentListingId: selectedListingId,
        }),
      });
      if (!res.ok) throw new Error("Failed to link listing");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-equipment-plan", projectId] });
      invalidateProjectPipeline(queryClient, projectId, ["equipment"]);
      setPortalMessage("Marketplace listing linked to equipment plan item.");
    },
  });

  useEffect(() => {
    if (!selectedItemId && items.length > 0) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) {
      setSelectedListingId("");
      return;
    }
    const selectedItem = items.find((item) => item.id === selectedItemId);
    setSelectedListingId(selectedItem?.equipmentListingId ?? "");
  }, [selectedItemId, items]);

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
              Build equipment plans, browse marketplace gear with photos, send free hire requests, and link listings to plan items.
            </p>
          </div>
          
        </div>
      </header>
      
      {portalMessage && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {portalMessage}
        </p>
      )}
      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <div className="creator-glass-panel p-4 space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category" className="bg-slate-900 border-slate-700 text-xs" />
            <Input value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Quantity" className="bg-slate-900 border-slate-700 text-xs" />
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs" onClick={() => createMutation.mutate()} disabled={!hasProject || createMutation.isPending}>
              Add equipment plan item
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">No equipment planned yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
                  <p className="text-slate-200 font-medium">{item.category} · Qty {item.quantity}</p>
                  <p className="text-slate-500">
                    Linked listing: {item.equipmentListing ? item.equipmentListing.companyName : "Not linked"}
                  </p>
                </div>
              ))}
            </div>
          )}
          {conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {conflicts.map((c, idx) => (
                <p key={`${c.message}-${idx}`}>- {c.message}</p>
              ))}
            </div>
          )}
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <div className="grid gap-2 md:grid-cols-2">
              <Input value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} placeholder="Filter category" className="bg-slate-900 border-slate-700 text-xs" />
              <Input value={filterSpecs} onChange={(e) => setFilterSpecs(e.target.value)} placeholder="Filter specifications" className="bg-slate-900 border-slate-700 text-xs" />
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-end">
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="h-10 min-w-[220px] rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-white">
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.category}</option>
                ))}
              </select>
              <select value={selectedListingId} onChange={(e) => setSelectedListingId(e.target.value)} className="h-10 min-w-[260px] rounded-lg border border-slate-600 bg-slate-900 px-3 text-sm text-white" disabled={marketplace.length === 0}>
                <option value="">Select marketplace listing</option>
                {marketplace.map((listing) => (
                  <option key={listing.id} value={listing.id}>{listing.name} · {listing.category}</option>
                ))}
              </select>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs" disabled={!selectedItemId || !selectedListingId || linkListingMutation.isPending} onClick={() => linkListingMutation.mutate()}>
                Link listing
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Open a listing for rates. Send a free request, message the company anytime, and pay once approved.
            </p>
            <EquipmentMarketplaceCatalog
              listings={marketplace}
              projectId={projectId}
              projectTitle={title}
              compact
              onRequestSuccess={setPortalMessage}
            />
          </div>
        </div>
      )}
      <Link
        href={projectId ? `/creator/equipment?projectId=${encodeURIComponent(projectId)}` : "/creator/equipment"}
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
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["project-risk", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/risk`),
    enabled: hasProject,
  });
  const plan = data?.plan as
    | {
        id: string;
        summary: string | null;
        items: Array<{
          id: string;
          category: string;
          title: string;
          description: string;
          severity: "LOW" | "MEDIUM" | "HIGH";
          likelihood: "LOW" | "MEDIUM" | "HIGH";
          ownerId: string | null;
          owner?: { id: string; name: string | null; email: string | null } | null;
          mitigationPlan: string | null;
          assignedRole: string | null;
          dueDate: string | null;
          linkedPolicyIds: string[];
          status: "OPEN" | "IN_PROGRESS" | "DONE";
          autoDetected: boolean;
        }>;
      }
    | null;
  const insurance = data?.insurance as { policies: Array<{
    id: string;
    providerName: string;
    coverageType: string;
    coverageAmount: number;
    validFrom: string | null;
    validTo: string | null;
    linkedRiskIds: string[];
    notes?: string | null;
  }> } | undefined;
  const checklists = (data?.checklists ?? []) as Array<{
    id: string;
    name: string;
    category: string;
    checked: boolean;
    note?: string | null;
  }>;
  const dashboard = data?.dashboard as
    | {
        counts: { total: number; unresolved: number; resolved: number; highUnresolved: number };
        byCategory: Array<{ category: string; total: number; unresolved: number; high: number }>;
        riskyDays: Array<{ id: string; date: string; sceneCount: number; callTime: string | null; wrapTime: string | null }>;
        readyToShoot: boolean;
        blockedReasons: string[];
        alerts: Array<{ type: string; severity: string; message: string; riskId: string }>;
      }
    | undefined;

  const [newCategory, setNewCategory] = useState("SAFETY");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [newLikelihood, setNewLikelihood] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [newMitigation, setNewMitigation] = useState("");
  const [newAssignedRole, setNewAssignedRole] = useState("Safety Officer");
  const [editRiskId, setEditRiskId] = useState("");
  const [editMitigation, setEditMitigation] = useState("");
  const [editStatus, setEditStatus] = useState<"OPEN" | "IN_PROGRESS" | "DONE">("OPEN");
  const [editPolicyIds, setEditPolicyIds] = useState<string[]>([]);
  const [policyProvider, setPolicyProvider] = useState("");
  const [policyCoverageType, setPolicyCoverageType] = useState("General Liability");
  const [policyAmount, setPolicyAmount] = useState("");
  const [policyValidFrom, setPolicyValidFrom] = useState("");
  const [policyValidTo, setPolicyValidTo] = useState("");
  const [policyNotes, setPolicyNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "DONE">("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "LOW" | "MEDIUM" | "HIGH">("ALL");

  const selectedRisk = useMemo(
    () => plan?.items.find((item) => item.id === editRiskId) ?? null,
    [plan?.items, editRiskId],
  );

  useEffect(() => {
    if (!editRiskId && (plan?.items.length ?? 0) > 0) {
      setEditRiskId(plan!.items[0]!.id);
    }
  }, [editRiskId, plan]);

  useEffect(() => {
    if (!selectedRisk) return;
    setEditMitigation(selectedRisk.mitigationPlan ?? "");
    setEditStatus(selectedRisk.status);
    setEditPolicyIds(selectedRisk.linkedPolicyIds ?? []);
  }, [selectedRisk]);

  const filteredItems = useMemo(() => {
    return (plan?.items ?? []).filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (severityFilter !== "ALL" && item.severity !== severityFilter) return false;
      return true;
    });
  }, [plan?.items, statusFilter, severityFilter]);

  const actionMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/creator/projects/${projectId}/risk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to update risk workspace");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-risk", projectId] });
    },
    onError: (error) => {
      setWorkspaceMessage(error instanceof Error ? error.message : "Failed to update risk workspace.");
    },
  });

  const createRiskItem = () => {
    if (!newTitle.trim() || !newDesc.trim()) return;
    actionMutation.mutate({
      action: "UPSERT_ITEM",
      item: {
        category: newCategory,
        title: newTitle.trim(),
        description: newDesc.trim(),
        severity: newSeverity,
        likelihood: newLikelihood,
        mitigationPlan: newMitigation.trim() || null,
        assignedRole: newAssignedRole.trim() || null,
        linkedPolicyIds: [],
        status: "OPEN",
      },
    });
    setNewTitle("");
    setNewDesc("");
    setNewMitigation("");
    setWorkspaceMessage("Risk item added.");
  };

  const saveSelectedRisk = () => {
    if (!selectedRisk) return;
    actionMutation.mutate({
      action: "UPSERT_ITEM",
      item: {
        id: selectedRisk.id,
        category: selectedRisk.category,
        title: selectedRisk.title,
        description: selectedRisk.description,
        severity: selectedRisk.severity,
        likelihood: selectedRisk.likelihood,
        mitigationPlan: editMitigation.trim() || null,
        assignedRole: selectedRisk.assignedRole,
        linkedPolicyIds: editPolicyIds,
        status: editStatus,
      },
    });
    setWorkspaceMessage("Risk item updated.");
  };

  const createPolicy = () => {
    if (!policyProvider.trim() || !policyCoverageType.trim()) return;
    actionMutation.mutate({
      action: "ADD_POLICY",
      policy: {
        providerName: policyProvider.trim(),
        coverageType: policyCoverageType.trim(),
        coverageAmount: Number(policyAmount || "0"),
        validFrom: policyValidFrom || null,
        validTo: policyValidTo || null,
        notes: policyNotes.trim() || null,
        linkedRiskIds: [],
      },
    });
    setPolicyProvider("");
    setPolicyAmount("");
    setPolicyNotes("");
    setWorkspaceMessage("Insurance policy added.");
  };

  const toggleChecklist = (id: string, checked: boolean) => {
    actionMutation.mutate({
      action: "TOGGLE_CHECKLIST",
      checklist: { id, checked },
    });
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
    <div className="space-y-5">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
              Pre-production workspace
            </p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Safety and compliance control layer across script, schedule, locations, equipment, contracts, and insurance.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            
          </div>
        </div>
      </header>
      
      {workspaceMessage ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">{workspaceMessage}</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardContent className="p-3 text-xs">
            <p className="text-slate-500">Total risks</p>
            <p className="text-xl font-semibold text-white">{dashboard?.counts.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardContent className="p-3 text-xs">
            <p className="text-slate-500">Unresolved</p>
            <p className="text-xl font-semibold text-amber-300">{dashboard?.counts.unresolved ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardContent className="p-3 text-xs">
            <p className="text-slate-500">High unresolved</p>
            <p className="text-xl font-semibold text-rose-300">{dashboard?.counts.highUnresolved ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardContent className="p-3 text-xs">
            <p className="text-slate-500">Ready to shoot</p>
            <p className={dashboard?.readyToShoot ? "text-xl font-semibold text-emerald-300" : "text-xl font-semibold text-rose-300"}>
              {dashboard?.readyToShoot ? "READY" : "BLOCKED"}
            </p>
          </CardContent>
        </Card>
      </div>

      {dashboard?.blockedReasons?.length ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          <p className="font-medium">Production readiness blocked</p>
          <ul className="mt-1 space-y-1 text-rose-200">
            {dashboard.blockedReasons.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/creator/projects/${projectId}/pre-production/production-scheduling`} className="text-rose-200 underline">Scheduling</Link>
            <Link href={`/creator/projects/${projectId}/pre-production/legal-contracts`} className="text-rose-200 underline">Legal & Contracts</Link>
            <Link href={`/creator/projects/${projectId}/pre-production/production-workspace`} className="text-rose-200 underline">Production Workspace</Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Create risk item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2 md:grid-cols-2">
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                  <option value="SAFETY">Safety</option>
                  <option value="STUNTS">Stunts</option>
                  <option value="VEHICLES">Vehicles</option>
                  <option value="EQUIPMENT">Equipment</option>
                  <option value="LOCATIONS">Locations</option>
                  <option value="LEGAL">Legal</option>
                  <option value="WEATHER">Weather</option>
                  <option value="CROWD_CONTROL">Crowd control</option>
                </select>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Risk title" className="h-9 bg-slate-900 border-slate-700 text-xs" />
              </div>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Risk description" className="h-9 bg-slate-900 border-slate-700 text-xs" />
              <div className="grid gap-2 md:grid-cols-3">
                <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as "LOW" | "MEDIUM" | "HIGH")} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                  <option value="LOW">Severity: Low</option>
                  <option value="MEDIUM">Severity: Medium</option>
                  <option value="HIGH">Severity: High</option>
                </select>
                <select value={newLikelihood} onChange={(e) => setNewLikelihood(e.target.value as "LOW" | "MEDIUM" | "HIGH")} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
                  <option value="LOW">Likelihood: Low</option>
                  <option value="MEDIUM">Likelihood: Medium</option>
                  <option value="HIGH">Likelihood: High</option>
                </select>
                <Input value={newAssignedRole} onChange={(e) => setNewAssignedRole(e.target.value)} placeholder="Responsible role" className="h-9 bg-slate-900 border-slate-700 text-xs" />
              </div>
              <textarea value={newMitigation} onChange={(e) => setNewMitigation(e.target.value)} rows={2} placeholder="Mitigation plan (required before resolved)" className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" />
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs" disabled={actionMutation.isPending || !newTitle.trim() || !newDesc.trim()} onClick={createRiskItem}>
                Add risk
              </Button>
            </CardContent>
          </Card>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risk register</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | "OPEN" | "IN_PROGRESS" | "DONE")} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                  <option value="ALL">All statuses</option>
                  <option value="OPEN">Unresolved</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="DONE">Resolved</option>
                </select>
                <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as "ALL" | "LOW" | "MEDIUM" | "HIGH")} className="h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                  <option value="ALL">All severities</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              {filteredItems.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">No risk items match this filter.</p>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEditRiskId(item.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                      editRiskId === item.id ? "border-orange-500/50 bg-orange-500/10" : "border-slate-800 bg-slate-900/70"
                    }`}
                  >
                    <p className="text-slate-100">{item.title}</p>
                    <p className="text-slate-400">
                      {item.category} · {item.severity} severity · {item.likelihood} likelihood · {item.status.replaceAll("_", " ")}
                      {item.autoDetected ? " · auto-detected" : ""}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Selected risk controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!selectedRisk ? (
                <p className="text-xs text-slate-500">Select a risk item to edit.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-200">{selectedRisk.title}</p>
                  <p className="text-[11px] text-slate-500">{selectedRisk.description}</p>
                  <textarea value={editMitigation} onChange={(e) => setEditMitigation(e.target.value)} rows={3} placeholder="Mitigation plan (required before resolved)" className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" />
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as "OPEN" | "IN_PROGRESS" | "DONE")} className="h-8 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-[11px] text-white">
                    <option value="OPEN">Unresolved</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Resolved</option>
                  </select>
                  <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
                    <p className="text-[11px] text-slate-400 mb-1">Linked insurance policies</p>
                    <div className="space-y-1">
                      {(insurance?.policies ?? []).length === 0 ? (
                        <p className="text-[11px] text-slate-500">No policies yet.</p>
                      ) : (
                        (insurance?.policies ?? []).map((policy) => (
                          <label key={policy.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                            <input
                              type="checkbox"
                              checked={editPolicyIds.includes(policy.id)}
                              onChange={(e) => {
                                setEditPolicyIds((prev) =>
                                  e.target.checked ? [...new Set([...prev, policy.id])] : prev.filter((id) => id !== policy.id),
                                );
                              }}
                            />
                            <span>{policy.providerName} · {policy.coverageType}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs" disabled={actionMutation.isPending} onClick={saveSelectedRisk}>
                    Save risk controls
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Insurance policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input value={policyProvider} onChange={(e) => setPolicyProvider(e.target.value)} placeholder="Provider name" className="h-9 bg-slate-900 border-slate-700 text-xs" />
              <div className="grid gap-2 grid-cols-2">
                <Input value={policyCoverageType} onChange={(e) => setPolicyCoverageType(e.target.value)} placeholder="Coverage type" className="h-9 bg-slate-900 border-slate-700 text-xs" />
                <Input value={policyAmount} onChange={(e) => setPolicyAmount(e.target.value)} placeholder="Coverage amount" className="h-9 bg-slate-900 border-slate-700 text-xs" />
              </div>
              <div className="grid gap-2 grid-cols-2">
                <Input type="date" value={policyValidFrom} onChange={(e) => setPolicyValidFrom(e.target.value)} className="h-9 bg-slate-900 border-slate-700 text-xs" />
                <Input type="date" value={policyValidTo} onChange={(e) => setPolicyValidTo(e.target.value)} className="h-9 bg-slate-900 border-slate-700 text-xs" />
              </div>
              <textarea value={policyNotes} onChange={(e) => setPolicyNotes(e.target.value)} rows={2} placeholder="Policy notes / conditions" className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" />
              <Button size="sm" variant="outline" className="border-cyan-600/60 text-cyan-200 text-xs" disabled={actionMutation.isPending || !policyProvider.trim() || !policyCoverageType.trim()} onClick={createPolicy}>
                Add policy
              </Button>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {(insurance?.policies ?? []).map((policy) => (
                  <div key={policy.id} className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300">
                    <p>{policy.providerName} · {policy.coverageType} · {formatZar(Math.round(policy.coverageAmount), { maximumFractionDigits: 0 })}</p>
                    <p className="text-slate-500">
                      {policy.validFrom ? new Date(policy.validFrom).toLocaleDateString() : "No start"} - {policy.validTo ? new Date(policy.validTo).toLocaleDateString() : "No end"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Safety and compliance checklists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              {checklists.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-slate-300">
                  <input type="checkbox" checked={item.checked} onChange={(e) => toggleChecklist(item.id, e.target.checked)} />
                  <span>{item.name}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(dashboard?.alerts ?? []).length === 0 ? (
              <p className="text-slate-500">No active risk alerts.</p>
            ) : (
              (dashboard?.alerts ?? []).map((alert, idx) => (
                <p key={`${alert.riskId}-${idx}`} className={alert.severity === "HIGH" ? "text-rose-200" : "text-amber-200"}>
                  [{alert.severity}] {alert.message}
                </p>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="creator-glass-panel border-0 bg-transparent shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risky production days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            {(dashboard?.riskyDays ?? []).length === 0 ? (
              <p className="text-slate-500">No high-load days detected.</p>
            ) : (
              (dashboard?.riskyDays ?? []).map((day) => (
                <p key={day.id} className="text-slate-300">
                  {new Date(day.date).toLocaleDateString()} · {day.sceneCount} scenes
                  {day.callTime && day.wrapTime ? ` · ${day.callTime} to ${day.wrapTime}` : ""}
                </p>
              ))
            )}
          </CardContent>
        </Card>
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
  const { data, isLoading } = useQuery({
    queryKey: ["project-readiness", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/readiness`),
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
            
          </div>
        </div>
      </header>
      
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
              Upload reference images into the catalogue below — organized by world, mood, tone, direction, characters, locations, and
              scenes — so the team shares one visual language for the film.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            
          </div>
        </div>
      </header>
      {hasProject && projectId ? <VisualPlanningCatalogue projectId={projectId} /> : null}
      
    </div>
  );
}


