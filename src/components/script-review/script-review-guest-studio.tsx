"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquare,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { creatorToolSelectSm } from "@/lib/ui/creator-tool-select";
import {
  CORE_REVIEW_LAYER_IDS,
  HOD_REVIEW_LAYER_IDS,
  REVIEW_LAYERS,
  paginateScreenplay,
  type ReviewAnnotationRecord,
  type ReviewLayerId,
  type ReviewStamp,
  type ReviewTool,
} from "@/lib/script-review/types";
import { REVIEW_STAMPS } from "@/lib/script-review/stamps";
import { ReviewPageCanvas } from "./review-page-canvas";
import { ReviewThreadsPanel } from "./review-threads-panel";

type GuestSessionPayload = {
  guest: {
    name: string;
    email: string | null;
    inviterName: string | null;
    expiresAt: string | null;
  };
  session: {
    id: string;
    reviewStatus: string;
    annotations: ReviewAnnotationRecord[];
  };
  draft: {
    title: string;
    content: string;
  };
};

export function ScriptReviewGuestStudio() {
  const queryClient = useQueryClient();
  const [tool, setTool] = useState<ReviewTool>("comment");
  const [selectedStamp, setSelectedStamp] = useState<ReviewStamp>("approved");
  const [activeLayer, setActiveLayer] = useState<ReviewLayerId>("producer");
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [darkRead, setDarkRead] = useState(false);
  const [rightTab, setRightTab] = useState<"canvas" | "threads">("threads");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["script-review-guest-session"],
    queryFn: async () => {
      const res = await fetch("/api/script-review/guest/session", { credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Session expired");
      return j as GuestSessionPayload;
    },
    refetchInterval: 45_000,
  });

  const annotations = useMemo(() => data?.session.annotations ?? [], [data?.session.annotations]);
  const pages = useMemo(
    () => paginateScreenplay(data?.draft.content ?? ""),
    [data?.draft.content],
  );

  const visibleLayers = useMemo(() => new Set(REVIEW_LAYERS.map((l) => l.id)), []);

  const createAnnotation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/script-review/guest/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ layer: activeLayer, ...payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not save note");
      return j as { annotation: ReviewAnnotationRecord };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["script-review-guest-session"] });
    },
  });

  const patchAnnotation = useMutation({
    mutationFn: async (payload: { id: string; resolved?: boolean }) => {
      const res = await fetch("/api/script-review/guest/annotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not update");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["script-review-guest-session"] });
    },
  });

  const threadComments = annotations.filter(
    (a) => a.type === "comment" || a.type === "sticky" || Boolean(a.body),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-black text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-orange-300" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <p className="text-sm text-slate-300">
          {error instanceof Error ? error.message : "This guest session is no longer valid."}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const toolbarTools: Array<{ id: ReviewTool; label: string }> = [
    { id: "red_pen", label: "Red pen" },
    { id: "highlighter", label: "Highlight" },
    { id: "free_draw", label: "Draw" },
    { id: "comment", label: "Comment" },
    { id: "sticky", label: "Sticky" },
    { id: "stamp", label: "Stamp" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-black text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-300/80">
            Guest script review
          </p>
          <h1 className="truncate text-sm font-semibold text-white md:text-base">
            {data.draft.title}
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Invited by {data.guest.inviterName || "creator"} · signed in as{" "}
            <span className="text-slate-300">{data.guest.name}</span>
            {data.guest.expiresAt ? (
              <>
                {" "}
                · access until {new Date(data.guest.expiresAt).toLocaleString()}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <FileText className="h-3.5 w-3.5" />
          Script Review only — no other tools
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-3 py-2">
        {toolbarTools.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            className={`rounded px-2 py-1 text-[10px] ${
              tool === t.id ? "bg-orange-500/20 text-orange-300" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        {tool === "stamp" ? (
          <select
            value={selectedStamp}
            onChange={(e) => setSelectedStamp(e.target.value as ReviewStamp)}
            className={creatorToolSelectSm("text-[10px]")}
          >
            {REVIEW_STAMPS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={activeLayer}
          onChange={(e) => setActiveLayer(e.target.value as ReviewLayerId)}
          className={creatorToolSelectSm("ml-auto text-[10px]")}
        >
          <optgroup label="Notes">
            {REVIEW_LAYERS.filter((l) => CORE_REVIEW_LAYER_IDS.includes(l.id)).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Production HODs">
            {REVIEW_LAYERS.filter((l) => HOD_REVIEW_LAYER_IDS.includes(l.id)).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </optgroup>
        </select>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-slate-300"
          onClick={() => setZoom((z) => Math.max(70, z - 10))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-slate-500">{zoom}%</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-slate-300"
          onClick={() => setZoom((z) => Math.min(140, z + 10))}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[10px] text-slate-300"
          onClick={() => setDarkRead((d) => !d)}
        >
          {darkRead ? "Light" : "Dark"}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="order-1 flex min-w-0 flex-1 flex-col p-3 md:p-4">
          <div
            className={`min-h-[min(50vh,640px)] overflow-y-auto rounded-xl border border-slate-800 p-3 sm:p-4 ${
              darkRead ? "bg-slate-950" : "bg-slate-200"
            }`}
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
          >
            <ReviewPageCanvas
              pageIndex={page}
              lines={pages[page] ?? []}
              globalLineOffset={page * 55}
              annotations={annotations}
              visibleLayers={visibleLayers}
              tool={tool}
              selectedStamp={selectedStamp}
              layer={activeLayer}
              canAnnotate
              peers={[]}
              onCreateAnnotation={(p) => {
                void createAnnotation.mutateAsync(p);
              }}
              onAddComment={(lineIndex, text, dataPayload) => {
                void createAnnotation.mutateAsync({
                  type: "comment",
                  pageIndex: Math.floor(lineIndex / 55),
                  lineIndex,
                  body: text,
                  data: dataPayload ?? {},
                });
              }}
            />
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-slate-400">
              Page {page + 1} / {Math.max(1, pages.length)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={page >= pages.length - 1}
              onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </main>

        <aside className="order-2 flex w-full shrink-0 flex-col border-t border-white/10 md:w-80 md:border-l md:border-t-0">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium text-white">Threads</p>
            <span className="text-[10px] text-slate-500">{threadComments.length}</span>
            <button
              type="button"
              className="ml-auto text-[10px] text-slate-500 hover:text-white md:hidden"
              onClick={() => setRightTab(rightTab === "threads" ? "canvas" : "threads")}
            >
              {rightTab === "threads" ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ReviewThreadsPanel
              threads={threadComments}
              canReply
              onResolve={(id) => patchAnnotation.mutate({ id, resolved: true })}
              onReply={(parentId, body) => {
                void createAnnotation.mutateAsync({
                  type: "comment",
                  parentId,
                  body,
                  pageIndex: 0,
                });
              }}
              onJumpToLine={(lineIndex) => {
                setPage(Math.floor(lineIndex / 55));
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
