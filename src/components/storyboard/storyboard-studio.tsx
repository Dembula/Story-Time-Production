"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clapperboard,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  Wand2,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import {
  STORYBOARD_ASPECT_RATIOS,
  STORYBOARD_STYLE_PRESETS,
} from "@/lib/storyboard/style-presets";
import { StoryboardGuestInvitePanel } from "@/components/storyboard/storyboard-guest-invite-panel";
import { StoryboardPresenter } from "@/components/storyboard/storyboard-presenter";
import { cn } from "@/lib/utils";

type Frame = {
  id: string;
  sceneId: string | null;
  sceneNumber: string | null;
  sceneHeading: string | null;
  shotLabel: string | null;
  sortOrder: number;
  prompt: string;
  directorNotes: string | null;
  imageUrl: string | null;
  generationStatus: string;
  generationError: string | null;
  styleOverride: string | null;
  lastEditPrompt: string | null;
};

type Board = {
  id: string;
  title: string;
  scriptKey: string | null;
  scriptLabel: string | null;
  stylePreset: string;
  aspectRatio: string;
  status: string;
  globalNotes: string | null;
  frames: Frame[];
  _count?: { frames: number; guestInvites: number };
};

type ScriptOption = { key: string; label: string };

async function readJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data;
}

export function StoryboardStudio({
  projectId,
  title = "Storyboard Studio",
}: {
  projectId?: string;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [newTitle, setNewTitle] = useState("Main storyboard");
  const [newStyle, setNewStyle] = useState("cinematic");
  const [newAspect, setNewAspect] = useState("16:9");
  const [newScriptKey, setNewScriptKey] = useState("");
  const [newBrief, setNewBrief] = useState("");
  const [boardBrief, setBoardBrief] = useState("");
  const [shotsPerScene, setShotsPerScene] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  const hasProject = Boolean(projectId);

  const { data: boardsData, isLoading } = useQuery({
    queryKey: ["project-storyboards", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/storyboard`);
      return readJsonOrThrow(res) as Promise<{ boards: Board[] }>;
    },
    enabled: hasProject,
  });

  const { data: scriptData } = useQuery({
    queryKey: ["project-script", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/script`);
      if (!res.ok) return { versions: [] as Array<{ id: string; label?: string; version?: number }> };
      return res.json();
    },
    enabled: hasProject,
  });

  const { data: creatorScripts } = useQuery({
    queryKey: ["creator-scripts-storyboard", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/scripts?projectId=${projectId}`);
      if (!res.ok) return [] as Array<{ id: string; title: string }>;
      const j = await res.json();
      return (Array.isArray(j) ? j : j.scripts ?? []) as Array<{ id: string; title: string }>;
    },
    enabled: hasProject,
  });

  const scriptOptions: ScriptOption[] = useMemo(() => {
    const opts: ScriptOption[] = [];
    const versions = (scriptData as { versions?: Array<{ id: string; label?: string; version?: number }> })
      ?.versions;
    for (const v of versions ?? []) {
      opts.push({
        key: `project-version:${v.id}`,
        label: v.label || `Project draft v${v.version ?? "?"}`,
      });
    }
    for (const s of creatorScripts ?? []) {
      opts.push({ key: `creator-script:${s.id}`, label: s.title || "Library script" });
    }
    return opts;
  }, [scriptData, creatorScripts]);

  const boards = boardsData?.boards ?? [];
  const selectedBoard =
    boards.find((b) => b.id === selectedBoardId) ?? boards[0] ?? null;
  const frames = selectedBoard?.frames ?? [];
  const selectedFrame =
    frames.find((f) => f.id === selectedFrameId) ?? frames[0] ?? null;

  useEffect(() => {
    setBoardBrief(selectedBoard?.globalNotes ?? "");
  }, [selectedBoard?.id, selectedBoard?.globalNotes]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["project-storyboards", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["creator-projects"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const script = scriptOptions.find((o) => o.key === newScriptKey) ?? scriptOptions[0];
      const res = await fetch(`/api/creator/projects/${projectId}/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          stylePreset: newStyle,
          aspectRatio: newAspect,
          scriptKey: script?.key,
          scriptLabel: script?.label,
          globalNotes: newBrief.trim() || null,
        }),
      });
      return readJsonOrThrow(res) as Promise<{ board: Board }>;
    },
    onSuccess: async (data) => {
      setCreateOpen(false);
      setNewBrief("");
      setSelectedBoardId(data.board.id);
      setBoardBrief(data.board.globalNotes ?? "");
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not create board"),
  });

  const saveBriefIfNeeded = async (boardId: string) => {
    const next = boardBrief.trim();
    const current = (selectedBoard?.globalNotes ?? "").trim();
    if (next === current) return;
    const res = await fetch(`/api/creator/projects/${projectId}/storyboard/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalNotes: next || null }),
    });
    await readJsonOrThrow(res);
  };

  const generateMutation = useMutation({
    mutationFn: async (opts: { regenerateExisting?: boolean }) => {
      if (!selectedBoard) throw new Error("Select a board first");
      await saveBriefIfNeeded(selectedBoard.id);
      const res = await fetch(
        `/api/creator/projects/${projectId}/storyboard/${selectedBoard.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotsPerScene,
            regenerateExisting: opts.regenerateExisting ?? false,
          }),
        },
      );
      return readJsonOrThrow(res);
    },
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Generation failed"),
  });

  const frameMutation = useMutation({
    mutationFn: async (payload: {
      frameId: string;
      editInstruction?: string;
      regenerate?: boolean;
      prompt?: string;
      directorNotes?: string;
    }) => {
      if (!selectedBoard) throw new Error("No board");
      const res = await fetch(
        `/api/creator/projects/${projectId}/storyboard/${selectedBoard.id}/frames/${payload.frameId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      return readJsonOrThrow(res);
    },
    onSuccess: async () => {
      setEditInstruction("");
      setError(null);
      await invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Frame update failed"),
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/storyboard/${boardId}`, {
        method: "DELETE",
      });
      return readJsonOrThrow(res);
    },
    onSuccess: async () => {
      setSelectedBoardId(null);
      await invalidate();
    },
  });

  const deleteFrameMutation = useMutation({
    mutationFn: async (frameId: string) => {
      if (!selectedBoard) throw new Error("No board");
      const res = await fetch(
        `/api/creator/projects/${projectId}/storyboard/${selectedBoard.id}/frames/${frameId}`,
        { method: "DELETE" },
      );
      return readJsonOrThrow(res);
    },
    onSuccess: async () => {
      setSelectedFrameId(null);
      await invalidate();
    },
  });

  const busy =
    createMutation.isPending ||
    generateMutation.isPending ||
    frameMutation.isPending ||
    deleteBoardMutation.isPending;

  if (!hasProject) {
    return (
      <div className="creator-tool-workspace space-y-4">
        <header className="storytime-section p-6">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Link a project to build AI storyboards from your script scenes.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="creator-tool-workspace space-y-4">
      <header className="storytime-section flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-orange-400/80">Pre-production</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Generate shot-by-shot frames from your script, ask VA to refine any panel, present in
            fullscreen, and share timed view-only guest links.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link
              href={`/creator/projects/${projectId}/pre-production/script-breakdown`}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-orange-500/40 hover:text-orange-200"
            >
              ← Breakdown Studio
            </Link>
            <Link
              href={`/creator/projects/${projectId}/pre-production/budget-builder`}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-orange-500/40 hover:text-orange-200"
            >
              Budget Builder →
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400"
          >
            <Plus className="h-4 w-4" /> New board
          </button>
          {selectedBoard ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-orange-500/40"
            >
              <Share2 className="h-4 w-4" /> Invite guests
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* Boards list */}
        <aside className="storytime-section space-y-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <LayoutGrid className="h-3.5 w-3.5" /> Boards
          </div>
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : null}
          {boards.length === 0 && !isLoading ? (
            <p className="text-sm text-slate-500">No boards yet. Create one to start.</p>
          ) : null}
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              onClick={() => {
                setSelectedBoardId(board.id);
                setSelectedFrameId(null);
              }}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left transition",
                selectedBoard?.id === board.id
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-600",
              )}
            >
              <p className="truncate text-sm font-medium text-white">{board.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {board._count?.frames ?? board.frames.length} frames · {board.status}
              </p>
            </button>
          ))}
        </aside>

        {/* Frame canvas */}
        <section className="storytime-section p-4">
          {!selectedBoard ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-slate-500">
              <Clapperboard className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">Select or create a storyboard board.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedBoard.title}</h2>
                  <p className="text-xs text-slate-500">
                    {selectedBoard.scriptLabel || "No script linked"} · {selectedBoard.stylePreset} ·{" "}
                    {selectedBoard.aspectRatio}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    Shots/scene
                    <select
                      value={shotsPerScene}
                      onChange={(e) => setShotsPerScene(Number(e.target.value))}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void generateMutation.mutate({
                        regenerateExisting: frames.length > 0,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {frames.length > 0 ? "Regenerate" : "Generate"}
                  </button>
                  {frames.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPresenting(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-orange-500/40"
                    >
                      <Maximize2 className="h-4 w-4" /> Present
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Delete this storyboard board?")) {
                        void deleteBoardMutation.mutate(selectedBoard.id);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="mb-4 block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Generation brief</span>
                <textarea
                  value={boardBrief}
                  onChange={(e) => setBoardBrief(e.target.value)}
                  rows={3}
                  placeholder="Shot types, angles, lenses, mood — saved before Generate / Regenerate."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>

              {frames.length === 0 ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
                  <Wand2 className="mb-3 h-8 w-8 text-orange-400/70" />
                  <p className="text-sm text-slate-300">Ready to draw your film.</p>
                  <p className="mt-1 max-w-md text-xs text-slate-500">
                    Add a brief above, then Generate. Scenes come from Breakdown — sync them first if
                    this project has none.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {frames.map((frame) => (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => setSelectedFrameId(frame.id)}
                      className={cn(
                        "overflow-hidden rounded-2xl border text-left transition",
                        selectedFrame?.id === frame.id
                          ? "border-orange-500/60 ring-1 ring-orange-500/30"
                          : "border-slate-800 hover:border-slate-600",
                      )}
                    >
                      <div className="relative aspect-video bg-slate-950">
                        {frame.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={frame.imageUrl}
                            alt={frame.shotLabel || "Storyboard frame"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-600">
                            {frame.generationStatus === "GENERATING" ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              frame.generationStatus
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-0.5 px-3 py-2">
                        <p className="truncate text-xs font-medium text-white">
                          {frame.shotLabel || `Scene ${frame.sceneNumber}`}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{frame.sceneHeading}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Frame inspector */}
        <aside className="storytime-section space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Frame</p>
            {selectedFrame && frames.length > 1 ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-white/5"
                  onClick={() => {
                    const idx = frames.findIndex((f) => f.id === selectedFrame.id);
                    const prev = frames[(idx - 1 + frames.length) % frames.length];
                    setSelectedFrameId(prev.id);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-white/5"
                  onClick={() => {
                    const idx = frames.findIndex((f) => f.id === selectedFrame.id);
                    const next = frames[(idx + 1) % frames.length];
                    setSelectedFrameId(next.id);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          {!selectedFrame ? (
            <p className="text-sm text-slate-500">Select a frame to edit with AI.</p>
          ) : (
            <>
              <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-800 bg-black">
                {selectedFrame.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedFrame.imageUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-600">
                    No image yet
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{selectedFrame.shotLabel}</p>
                <p className="text-xs text-slate-500">{selectedFrame.sceneHeading}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Prompt</p>
                <p className="max-h-28 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-300">
                  {selectedFrame.prompt}
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Ask VA to edit this shot</span>
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  rows={3}
                  placeholder="e.g. Wider establishing shot, colder blue light, add rain…"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !editInstruction.trim()}
                  onClick={() =>
                    void frameMutation.mutate({
                      frameId: selectedFrame.id,
                      editInstruction: editInstruction.trim(),
                    })
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  {frameMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Apply edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void frameMutation.mutate({
                      frameId: selectedFrame.id,
                      regenerate: true,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/40"
                  title="Redraw with the same prompt"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Delete this frame?")) {
                      void deleteFrameMutation.mutate(selectedFrame.id);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {selectedFrame.generationError ? (
                <p className="text-xs text-red-300">{selectedFrame.generationError}</p>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <p className="text-sm font-semibold text-white">New storyboard</p>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-1 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <label className="block space-y-1 text-xs text-slate-300">
                Title
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
                />
              </label>
              <label className="block space-y-1 text-xs text-slate-300">
                Script / draft
                <select
                  value={newScriptKey || scriptOptions[0]?.key || ""}
                  onChange={(e) => setNewScriptKey(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
                >
                  {scriptOptions.length === 0 ? (
                    <option value="">No drafts found — scenes still work</option>
                  ) : (
                    scriptOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="block space-y-1 text-xs text-slate-300">
                Visual style
                <select
                  value={newStyle}
                  onChange={(e) => setNewStyle(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
                >
                  {STORYBOARD_STYLE_PRESETS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs text-slate-300">
                Aspect ratio
                <select
                  value={newAspect}
                  onChange={(e) => setNewAspect(e.target.value)}
                  className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
                >
                  {STORYBOARD_ASPECT_RATIOS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs text-slate-300">
                Generation brief
                <span className="mt-0.5 block font-normal text-slate-500">
                  Guide the first pass — shot types, angles, lenses, pacing, what to emphasize.
                </span>
                <textarea
                  value={newBrief}
                  onChange={(e) => setNewBrief(e.target.value)}
                  rows={4}
                  placeholder="e.g. Mostly wide establishing + over-shoulder dialogue; handheld in chase scenes; low-angle hero shots for antagonist; cool teal night lighting…"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => void createMutation.mutate()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create board
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedBoard ? (
        <StoryboardGuestInvitePanel
          projectId={projectId!}
          boardId={selectedBoard.id}
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {presenting && selectedBoard && frames.length > 0 ? (
        <StoryboardPresenter
          title={selectedBoard.title}
          subtitle={selectedBoard.scriptLabel || selectedBoard.stylePreset}
          frames={frames}
          initialIndex={Math.max(
            0,
            frames.findIndex((f) => f.id === selectedFrame?.id),
          )}
          onClose={() => setPresenting(false)}
        />
      ) : null}
    </div>
  );
}
