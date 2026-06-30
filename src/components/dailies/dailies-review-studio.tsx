"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import type { DailiesIntelligencePayload, DailiesNoteRecord, DailiesDepartmentId } from "@/lib/dailies/types";
import type { DailiesTakeFlag, DailiesTakeStatus } from "@/lib/dailies/types";
import { DailiesStudioShell, type DailiesStudioTab } from "@/components/dailies/dailies-studio-shell";

export function DailiesReviewStudio({ projectId, title }: { projectId?: string; title: string }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const hasProject = !!projectId;

  const [studioTab, setStudioTab] = useState<DailiesStudioTab>("command");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"day" | "scene" | "camera">("day");
  const [filterShootDayId, setFilterShootDayId] = useState<string | null>(null);
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const [compareRightId, setCompareRightId] = useState<string | null>(null);
  const [activeDepartment, setActiveDepartment] = useState<DailiesDepartmentId | null>(null);
  const [reportShootDayId, setReportShootDayId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: intelligenceData, isLoading: intelligenceLoading, refetch } = useQuery({
    queryKey: ["project-dailies-intelligence", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/dailies/intelligence`),
    enabled: hasProject,
    refetchInterval: 15000,
  });

  const { data: scenesData } = useQuery({
    queryKey: ["project-scenes", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/scenes`),
    enabled: hasProject,
  });

  const { data: scheduleData } = useQuery({
    queryKey: ["project-shoot-progress", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/shoot-progress`),
    enabled: hasProject,
  });

  const { data: scriptData } = useQuery({
    queryKey: ["project-script-dailies", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/script`),
    enabled: hasProject,
  });

  const intelligence = (intelligenceData as { intelligence?: DailiesIntelligencePayload } | null)?.intelligence ?? null;

  const scenes = useMemo(
    () =>
      ((scenesData as { scenes?: Array<{ id: string; number: string; heading: string | null; summary?: string | null }> } | null)
        ?.scenes ?? []) as Array<{ id: string; number: string; heading: string | null; summary?: string | null }>,
    [scenesData],
  );

  const shootDays = useMemo(() => {
    const days =
      ((scheduleData as { shootDays?: Array<{ id: string; date: string; unit: string | null }> } | null)?.shootDays ??
        intelligence?.shootDays.map((d) => ({ id: d.shootDayId, date: d.date, unit: d.unit }))) ??
      [];
    return days;
  }, [scheduleData, intelligence?.shootDays]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "review") setStudioTab("review");
    else if (tab === "upload") setStudioTab("upload");
    else if (tab === "report") setStudioTab("report");
  }, [searchParams]);

  useEffect(() => {
    if (!intelligence?.clips.length) return;
    setSelectedClipId((prev) => {
      if (prev && intelligence.clips.some((c) => c.id === prev)) return prev;
      return intelligence.clips[0]?.id ?? null;
    });
    if (!reportShootDayId && intelligence.activeShootDay) {
      setReportShootDayId(intelligence.activeShootDay.shootDayId);
    }
  }, [intelligence, reportShootDayId]);

  const selectedClip = intelligence?.clips.find((c) => c.id === selectedClipId) ?? null;

  const scriptExcerpt = useMemo(() => {
    if (!selectedClip?.sceneId) return null;
    const scene = scenes.find((s) => s.id === selectedClip.sceneId);
    if (scene?.summary) return scene.summary;
    const versions = (scriptData as { script?: { versions?: Array<{ content: string }> } } | null)?.script?.versions;
    const content = versions?.[0]?.content ?? "";
    if (!content || !scene?.heading) return scene?.heading ?? null;
    const idx = content.toUpperCase().indexOf(scene.heading.toUpperCase().slice(0, 20));
    if (idx < 0) return scene.heading;
    return content.slice(idx, idx + 600);
  }, [selectedClip, scenes, scriptData]);

  const storyboardHref =
    selectedClip?.sceneNumber && projectId
      ? `/creator/projects/${projectId}/pre-production/visual-planning?category=scene&scene=${selectedClip.sceneNumber}`
      : null;

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ["project-dailies-notes", projectId, selectedClipId],
    queryFn: projectToolQueryFn(
      `/api/creator/projects/${projectId}/dailies/notes?clipId=${selectedClipId}`,
    ),
    enabled: hasProject && !!selectedClipId,
  });

  const clipNotes = useMemo(() => {
    let notes = ((notesData as { notes?: DailiesNoteRecord[] } | null)?.notes ?? []) as DailiesNoteRecord[];
    if (activeDepartment) notes = notes.filter((n) => n.department === activeDepartment);
    return notes;
  }, [notesData, activeDepartment]);

  const noteMutation = useMutation({
    mutationFn: async (payload: {
      body: string;
      timestampMs?: number;
      department?: string;
      priority?: string;
      category?: string;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/dailies/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId: selectedClipId, ...payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not save note");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-dailies-notes", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project-dailies-intelligence", projectId] });
    },
  });

  const clipPatchMutation = useMutation({
    mutationFn: async (payload: { takeStatus?: DailiesTakeStatus; takeFlags?: DailiesTakeFlag[] }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/dailies/clips`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedClipId, ...payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Update failed");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-dailies-intelligence", projectId] });
    },
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ["project-dailies-intelligence", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["project-dailies", projectId] });
    void refetch();
  }

  if (hasProject && intelligenceLoading && !intelligence) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <Skeleton className="h-64 bg-slate-800/60" />
      </div>
    );
  }

  return (
    <div className="creator-tool-studio space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
          Production workspace
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Professional Dailies Review Studio — review, approve, and distribute every take with timecoded notes, AI
          analysis, circle takes, and seamless links to script, storyboards, continuity, and editorial.
          {!hasProject && (
            <span className="mt-2 block text-amber-200/90">Link a project above to upload and review footage.</span>
          )}
        </p>
      </header>

      <DailiesStudioShell
        studioTab={studioTab}
        onStudioTabChange={setStudioTab}
        intelligence={intelligence}
        intelligenceLoading={hasProject && intelligenceLoading}
        projectId={projectId}
        selectedClipId={selectedClipId}
        onSelectClip={setSelectedClipId}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        filterShootDayId={filterShootDayId}
        onFilterShootDayId={setFilterShootDayId}
        compareLeftId={compareLeftId}
        compareRightId={compareRightId}
        onCompareLeftId={setCompareLeftId}
        onCompareRightId={setCompareRightId}
        activeDepartment={activeDepartment}
        onActiveDepartment={setActiveDepartment}
        reportShootDayId={reportShootDayId}
        onReportShootDayId={setReportShootDayId}
        clipNotes={clipNotes}
        notesLoading={notesLoading}
        onAddNote={(p) => noteMutation.mutate(p)}
        onUpdateTake={(p) => clipPatchMutation.mutate(p)}
        scriptExcerpt={scriptExcerpt}
        storyboardHref={storyboardHref}
        scenes={scenes}
        shootDays={shootDays}
        onUploaded={invalidateAll}
        uploading={uploading}
        setUploading={setUploading}
      />
    </div>
  );
}
