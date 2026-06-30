"use client";

import type { DailiesDepartmentId, DailiesIntelligencePayload, DailiesNoteRecord } from "@/lib/dailies/types";
import type { DailiesClipRecord, DailiesTakeFlag, DailiesTakeStatus } from "@/lib/dailies/types";
import {
  DailiesClipBrowser,
  DailiesCommandCenter,
  DailiesCompareView,
  DailiesDailyReportPanel,
  DailiesDepartmentsPanel,
  DailiesReviewWorkspace,
  DailiesUploadPanel,
} from "@/components/dailies/dailies-panels";

export type DailiesStudioTab =
  | "command"
  | "browser"
  | "review"
  | "compare"
  | "departments"
  | "report"
  | "upload";

const TABS: { id: DailiesStudioTab; label: string }[] = [
  { id: "command", label: "Dashboard" },
  { id: "browser", label: "Footage library" },
  { id: "review", label: "Review workspace" },
  { id: "compare", label: "Compare takes" },
  { id: "departments", label: "Departments" },
  { id: "report", label: "Daily report" },
  { id: "upload", label: "Upload" },
];

export function DailiesStudioShell({
  studioTab,
  onStudioTabChange,
  intelligence,
  intelligenceLoading,
  projectId,
  selectedClipId,
  onSelectClip,
  groupBy,
  onGroupByChange,
  filterShootDayId,
  onFilterShootDayId,
  compareLeftId,
  compareRightId,
  onCompareLeftId,
  onCompareRightId,
  activeDepartment,
  onActiveDepartment,
  reportShootDayId,
  onReportShootDayId,
  clipNotes,
  notesLoading,
  onAddNote,
  onUpdateTake,
  scriptExcerpt,
  storyboardHref,
  scenes,
  shootDays,
  onUploaded,
  uploading,
  setUploading,
}: {
  studioTab: DailiesStudioTab;
  onStudioTabChange: (tab: DailiesStudioTab) => void;
  intelligence: DailiesIntelligencePayload | null;
  intelligenceLoading: boolean;
  projectId?: string;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  groupBy: "day" | "scene" | "camera";
  onGroupByChange: (g: "day" | "scene" | "camera") => void;
  filterShootDayId: string | null;
  onFilterShootDayId: (id: string | null) => void;
  compareLeftId: string | null;
  compareRightId: string | null;
  onCompareLeftId: (id: string) => void;
  onCompareRightId: (id: string) => void;
  activeDepartment: DailiesDepartmentId | null;
  onActiveDepartment: (id: DailiesDepartmentId | null) => void;
  reportShootDayId: string | null;
  onReportShootDayId: (id: string) => void;
  clipNotes: DailiesNoteRecord[];
  notesLoading?: boolean;
  onAddNote: (payload: {
    body: string;
    timestampMs?: number;
    department?: string;
    priority?: string;
    category?: string;
  }) => void;
  onUpdateTake: (payload: { takeStatus?: DailiesTakeStatus; takeFlags?: DailiesTakeFlag[] }) => void;
  scriptExcerpt?: string | null;
  storyboardHref?: string | null;
  scenes: Array<{ id: string; number: string; heading: string | null }>;
  shootDays: Array<{ id: string; date: string; unit: string | null }>;
  onUploaded: () => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const selectedClip = intelligence?.clips.find((c) => c.id === selectedClipId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onStudioTabChange(t.id)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
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
          Loading dailies intelligence…
        </div>
      ) : null}

      {studioTab === "command" && intelligence ? (
        <DailiesCommandCenter intelligence={intelligence} projectId={projectId} />
      ) : null}

      {studioTab === "browser" && intelligence ? (
        <DailiesClipBrowser
          intelligence={intelligence}
          selectedClipId={selectedClipId}
          onSelectClip={(id) => {
            onSelectClip(id);
            onStudioTabChange("review");
          }}
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          filterShootDayId={filterShootDayId}
          onFilterShootDayId={onFilterShootDayId}
        />
      ) : null}

      {studioTab === "review" && intelligence ? (
        <DailiesReviewWorkspace
          clip={selectedClip}
          projectId={projectId}
          notes={clipNotes}
          notesLoading={notesLoading}
          onAddNote={onAddNote}
          onUpdateTake={onUpdateTake}
          scriptExcerpt={scriptExcerpt}
          storyboardHref={storyboardHref}
        />
      ) : null}

      {studioTab === "compare" && intelligence ? (
        <DailiesCompareView
          clips={intelligence.clips}
          leftId={compareLeftId}
          rightId={compareRightId}
          onLeftId={onCompareLeftId}
          onRightId={onCompareRightId}
        />
      ) : null}

      {studioTab === "departments" ? (
        <DailiesDepartmentsPanel activeDepartment={activeDepartment} onSelectDepartment={onActiveDepartment} />
      ) : null}

      {studioTab === "report" && intelligence ? (
        <DailiesDailyReportPanel
          intelligence={intelligence}
          shootDayId={reportShootDayId}
          onShootDayId={onReportShootDayId}
        />
      ) : null}

      {studioTab === "upload" && projectId ? (
        <DailiesUploadPanel
          projectId={projectId}
          scenes={scenes}
          shootDays={shootDays}
          onUploaded={onUploaded}
          uploading={uploading}
          setUploading={setUploading}
        />
      ) : null}
    </div>
  );
}
