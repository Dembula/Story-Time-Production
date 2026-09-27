"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditReviewPlayer, type EditReviewPlaybackHandle } from "./edit-review-player";
import {
  formatReviewTimecode,
  type EditReviewNote,
} from "@/lib/edit-review/types";
import { cn } from "@/lib/utils";

type GuestSessionPayload = {
  guest: {
    name: string;
    email: string | null;
    inviterName: string | null;
    expiresAt: string | null;
  };
  review: {
    id: string;
    title: string | null;
    notes: EditReviewNote[];
    cutAsset: { id: string; label: string | null } | null;
  };
  playback: { src: string; type: string } | null;
};

export function EditReviewGuestStudio() {
  const queryClient = useQueryClient();
  const playerRef = useRef<EditReviewPlaybackHandle>(null);
  const [commentBody, setCommentBody] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [commentError, setCommentError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["edit-review-guest-session"],
    queryFn: async () => {
      const res = await fetch("/api/edit-review/guest/session", { credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Session expired");
      return j as GuestSessionPayload;
    },
    refetchInterval: 45_000,
  });

  const notes = useMemo(() => {
    const list = data?.review.notes ?? [];
    return [...list].sort((a, b) => (a.timestampMs ?? 0) - (b.timestampMs ?? 0));
  }, [data?.review.notes]);

  const noteMutation = useMutation({
    mutationFn: async (payload: { body: string; timestampMs: number }) => {
      const res = await fetch("/api/edit-review/guest/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not post comment");
      return j as { note: EditReviewNote };
    },
    onSuccess: () => {
      setCommentBody("");
      setCommentError(null);
      void queryClient.invalidateQueries({ queryKey: ["edit-review-guest-session"] });
    },
    onError: (err) => {
      setCommentError(err instanceof Error ? err.message : "Could not post comment");
    },
  });

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

  const title =
    data.review.title || data.review.cutAsset?.label || "Edit review";

  return (
    <div className="flex min-h-screen flex-col bg-black text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-300/80">
            Guest review
          </p>
          <h1 className="truncate text-sm font-semibold text-white md:text-base">{title}</h1>
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
          <Film className="h-3.5 w-3.5" />
          Edit Review only — no other tools
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="order-2 flex w-full shrink-0 flex-col border-t border-white/10 md:order-1 md:w-80 md:border-r md:border-t-0">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium text-white">Comments</p>
            <span className="text-[10px] text-slate-500">{notes.length}</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 md:max-h-none">
            {notes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No comments yet. Leave feedback at the current playhead.
              </p>
            ) : (
              notes.map((note) => {
                const author =
                  note.user?.name?.trim() || note.guestName?.trim() || "Guest";
                const initial = (author[0] ?? "?").toUpperCase();
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      if (note.timestampMs != null) {
                        playerRef.current?.seekToMs(note.timestampMs);
                        setPlayheadMs(note.timestampMs);
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/20"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/25 text-[10px] font-medium text-sky-100">
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-slate-200">{author}</span>
                          {note.timestampMs != null ? (
                            <span className="rounded bg-amber-400/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-black">
                              {formatReviewTimecode(note.timestampMs)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{note.body}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-white/10 p-3">
            <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>Comment at playhead</span>
              <span className="font-mono text-amber-300/90">
                {formatReviewTimecode(playheadMs)}
              </span>
            </div>
            <textarea
              value={commentBody}
              onChange={(e) => {
                setCommentBody(e.target.value);
                setCommentError(null);
              }}
              placeholder="Leave your comment…"
              rows={3}
              className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-orange-400/40"
            />
            {commentError ? (
              <p className="mt-1 text-[11px] text-red-300">{commentError}</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="mt-2 w-full bg-orange-500 text-white hover:bg-orange-600"
              disabled={!commentBody.trim() || noteMutation.isPending}
              onClick={() =>
                noteMutation.mutate({
                  body: commentBody.trim(),
                  timestampMs: playheadMs,
                })
              }
            >
              {noteMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Send comment
            </Button>
          </div>
        </aside>

        <main className="order-1 flex min-w-0 flex-1 flex-col p-3 md:order-2 md:p-6">
          <EditReviewPlayer
            ref={playerRef}
            src={data.playback?.src ?? null}
            mimeType={data.playback?.type}
            notes={notes}
            onTimeUpdate={(ms) => setPlayheadMs(ms)}
            onNoteMarkerClick={(note) => {
              if (note.timestampMs != null) setPlayheadMs(note.timestampMs);
            }}
            className={cn(!data.playback?.src && "opacity-80")}
          />
          {!data.playback?.src ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              Playback isn’t ready yet. Ask the creator to confirm the cut has finished encoding.
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}
