"use client";



import type { ReactNode } from "react";

import type {

  BreakdownIntelligencePayload,

  CatalogAsset,

  BreakdownCategoryKey,

  BreakdownDepartmentId,

  BreakdownPayload,

} from "@/lib/breakdown/types";

import type { ScriptRevisionImpact } from "@/lib/breakdown/script-revision-impact";

import type { DepartmentWorkspacePayload } from "@/lib/breakdown/department-workspace";

import {

  BreakdownAssetSheet,

  BreakdownCatalogPanel,

  BreakdownCommandCenter,

  BreakdownSceneDashboard,

} from "@/components/breakdown/breakdown-panels";

import { BreakdownDepartmentView } from "@/components/breakdown/breakdown-department-view";

import { BreakdownScreenplayViewer } from "@/components/breakdown/breakdown-screenplay-viewer";

import { BreakdownRevisionPanel } from "@/components/breakdown/breakdown-revision-panel";

import { BreakdownDepartmentWorkspacePanel } from "@/components/breakdown/breakdown-department-workspace-panel";



export type BreakdownStudioTab =

  | "command"

  | "scenes"

  | "catalog"

  | "departments"

  | "screenplay"

  | "revisions"

  | "editor";



const TABS: { id: BreakdownStudioTab; label: string }[] = [

  { id: "command", label: "Command center" },

  { id: "scenes", label: "Scene dashboards" },

  { id: "screenplay", label: "Screenplay" },

  { id: "catalog", label: "Production catalog" },

  { id: "departments", label: "Departments" },

  { id: "revisions", label: "Revisions" },

  { id: "editor", label: "Breakdown editor" },

];



export function BreakdownStudioShell({

  studioTab,

  onStudioTabChange,

  intelligence,

  intelligenceLoading,

  projectId,

  selectedSceneId,

  onSelectScene,

  onEditScene,

  selectedAsset,

  onSelectAsset,

  onCloseAsset,

  activeDepartment,

  onActiveDepartment,

  highlightCategory,

  onHighlightCategory,

  onRunAi,

  aiRunning,

  editor,

  screenplayContent,

  breakdownDraft,

  revisionImpact,

  revisionLoading,

  departmentWorkspace,

  departmentWorkspaceLoading,

}: {

  studioTab: BreakdownStudioTab;

  onStudioTabChange: (tab: BreakdownStudioTab) => void;

  intelligence: BreakdownIntelligencePayload | null;

  intelligenceLoading: boolean;

  projectId?: string;

  selectedSceneId: string | null;

  onSelectScene: (id: string) => void;

  onEditScene?: (sceneId: string, mode: "scene" | "items") => void;

  selectedAsset: CatalogAsset | null;

  onSelectAsset: (asset: CatalogAsset | null) => void;

  onCloseAsset: () => void;

  activeDepartment: BreakdownDepartmentId | null;

  onActiveDepartment: (id: BreakdownDepartmentId | null) => void;

  highlightCategory: BreakdownCategoryKey | null;

  onHighlightCategory: (cat: BreakdownCategoryKey | null) => void;

  onRunAi?: () => void;

  aiRunning?: boolean;

  editor: ReactNode;

  screenplayContent?: string;

  breakdownDraft?: BreakdownPayload | null;

  revisionImpact?: ScriptRevisionImpact | null;

  revisionLoading?: boolean;

  departmentWorkspace?: DepartmentWorkspacePayload | null;

  departmentWorkspaceLoading?: boolean;

}) {

  const filteredCatalog =

    intelligence?.catalog.filter((a) => {

      if (activeDepartment && a.departmentId !== activeDepartment) return false;

      if (highlightCategory && a.category !== highlightCategory) return false;

      return true;

    }) ?? [];



  const scenesForHighlight =

    intelligence?.scenes.map((s) => ({ id: s.sceneId, number: s.sceneNumber })) ?? [];



  return (

    <div className="creator-tool-studio space-y-4">

      <div className="creator-tool-studio-tabs border-b border-slate-800 pb-3">

        {TABS.map((t) => (

          <button

            key={t.id}

            type="button"

            onClick={() => onStudioTabChange(t.id)}

            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${

              studioTab === t.id

                ? "bg-orange-500 text-white"

                : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"

            }`}

          >

            {t.label}

          </button>

        ))}

      </div>



      {intelligenceLoading && !intelligence ? (

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-500">

          Computing production intelligence…

        </div>

      ) : null}



      {studioTab === "command" && intelligence ? (

        <BreakdownCommandCenter

          intelligence={intelligence}

          projectId={projectId}

          onRunAi={onRunAi}

          aiRunning={aiRunning}

        />

      ) : null}



      {studioTab === "scenes" && intelligence ? (

        <BreakdownSceneDashboard

          intelligence={intelligence}

          projectId={projectId}

          selectedSceneId={selectedSceneId}

          onSelectScene={onSelectScene}

          onEditScene={onEditScene}

        />

      ) : null}



      {studioTab === "screenplay" && breakdownDraft ? (

        <BreakdownScreenplayViewer

          content={screenplayContent ?? ""}

          scenes={scenesForHighlight}

          draft={breakdownDraft}

          highlightCategory={highlightCategory}

          focusSceneId={selectedSceneId}

        />

      ) : null}



      {studioTab === "catalog" ? (

        <BreakdownCatalogPanel catalog={filteredCatalog} onSelectAsset={onSelectAsset} />

      ) : null}



      {studioTab === "departments" && intelligence ? (

        <div className="space-y-6">

          <BreakdownDepartmentView

            departmentCounts={intelligence.departmentCounts}

            activeDepartment={activeDepartment}

            onSelectDepartment={onActiveDepartment}

            highlightCategory={highlightCategory}

            onHighlightCategory={onHighlightCategory}

            onViewScreenplay={() => onStudioTabChange("screenplay")}

          />

          <BreakdownDepartmentWorkspacePanel

            workspace={departmentWorkspace ?? null}

            loading={departmentWorkspaceLoading}

          />

        </div>

      ) : null}



      {studioTab === "revisions" ? (

        <BreakdownRevisionPanel impact={revisionImpact ?? null} loading={revisionLoading} />

      ) : null}



      {studioTab === "editor" ? editor : null}



      <BreakdownAssetSheet
        asset={selectedAsset}
        onClose={onCloseAsset}
        procurement={
          selectedAsset && departmentWorkspace
            ? (() => {
                const match = departmentWorkspace.assets.find(
                  (a) => a.id === selectedAsset.id && a.category === selectedAsset.category,
                );
                return match
                  ? {
                      poStatus: match.poStatus,
                      poNumber: match.poNumber,
                      rentalStatus: match.rentalStatus,
                    }
                  : undefined;
              })()
            : undefined
        }
      />

    </div>

  );

}


