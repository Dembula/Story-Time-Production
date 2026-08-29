"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Film,
  Loader2,
  MessageSquare,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EditReviewPlayer, type EditReviewPlaybackHandle } from "./edit-review-player";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import {
  formatReviewTimecode,
  parseReviewStatus,
  type EditFootageAsset,
  type EditReviewNote,
  type EditReviewPlaybackResponse,
  type EditReviewSession,
  type EditReviewStatus,
} from "@/lib/edit-review/types";
import { cn } from "@/lib/utils";

/** Prefer H.264 MP4 for instant browser review; other formats encode via Stream. */
const UPLOAD_ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.m4v,.webm,.mov";
/** Large masters can take a while; never leave the button spinning forever. */
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

type EditReviewStudioProps = {
  projectId?: string;
  title?: string;
};

export function EditReviewStudio({
  projectId,
  title = "Edit Review",
}: EditReviewStudioProps) {
  const queryClient = useQueryClient();
  const playerRef = useRef<EditReviewPlaybackHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const hasProject = !!projectId;

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EditReviewStatus>("all");

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["project-reviews", projectId],
    queryFn: projectToolQueryFn<{ reviews: EditReviewSession[] }>(
      `/api/creator/projects/${projectId}/reviews`,
    ),
    enabled: hasProject,
    refetchInterval: 15_000,
  });

  const { data: footageData, isLoading: footageLoading } = useQuery({
    queryKey: ["project-footage", projectId, "EDIT"],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/footage?type=EDIT`),
    enabled: hasProject,
  });

  const reviews = useMemo(
    () => (reviewsData?.reviews ?? []) as EditReviewSession[],
    [reviewsData?.reviews],
  );
  const edits = (footageData?.assets ?? []) as EditFootageAsset[];

  const filteredReviews = useMemo(() => {
    if (statusFilter === "all") return reviews;
    return reviews.filter((r) => parseReviewStatus(r.status) === statusFilter);
  }, [reviews, statusFilter]);

  const selectedReview = reviews.find((r) => r.id === selectedReviewId) ?? null;

  useEffect(() => {
    if (!reviews.length) {
      setSelectedReviewId(null);
      return;
    }
    setSelectedReviewId((prev) => {
      if (prev && reviews.some((r) => r.id === prev)) return prev;
      return reviews[0]?.id ?? null;
    });
  }, [reviews]);

  const cutAssetId = selectedReview?.cutAsset?.id ?? null;

  const {
    data: playbackPayload,
    isPending: playbackPending,
    isError: playbackIsError,
    error: playbackError,
    refetch: refetchPlayback,
  } = useQuery({
    queryKey: ["edit-review-playback", projectId, cutAssetId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/reviews/playback?assetId=${encodeURIComponent(cutAssetId!)}`,
        { credentials: "include", signal },
      );
      const json = (await res.json().catch(() => ({}))) as EditReviewPlaybackResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Could not resolve playback");
      }
      return json;
    },
    enabled: Boolean(hasProject && cutAssetId && projectId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Keep polling while encoding, but not when we already have a playable src.
      if (query.state.data?.playback?.src) return false;
      return status === "encoding" || status === "failed" ? 8_000 : false;
    },
    staleTime: 60_000,
    retry: 1,
  });

  const playbackUrl = playbackPayload?.playback?.src ?? null;
  const playbackMime = playbackPayload?.playback?.type ?? null;
  const playbackStatusMessage = playbackUrl
    ? playbackPayload?.message ?? null
    : playbackPayload?.message ||
      (playbackPending
        ? "Resolving playback…"
        : playbackIsError
          ? playbackError instanceof Error
            ? playbackError.message
            : "Could not resolve playback"
          : "Playback not ready");

  const createReviewMutation = useMutation({
    mutationFn: async (payload: { cutAssetId: string; title?: string }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not create review");
      return j as { review: EditReviewSession };
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["project-reviews", projectId] });
      setSelectedReviewId(data.review.id);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { id: string; status: EditReviewStatus }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/reviews`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Update failed");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-reviews", projectId] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async (payload: { reviewId: string; body: string; timestampMs?: number }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/reviews/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not save comment");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-reviews", projectId] });
      setCommentBody("");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/reviews/notes?noteId=${encodeURIComponent(noteId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not delete comment");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-reviews", projectId] });
    },
  });

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !projectId) return;
      const file = files[0]!;

      uploadAbortRef.current?.abort();
      const abort = new AbortController();
      uploadAbortRef.current = abort;
      const timeoutId = window.setTimeout(() => abort.abort(), UPLOAD_TIMEOUT_MS);

      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      try {
        const fileUrl = await uploadContentMediaViaApi(file, {
          signal: abort.signal,
          onProgress: (pct) => setUploadProgress(pct),
        });
        if (abort.signal.aborted) throw new Error("Upload cancelled");

        setUploadProgress(100);
        const label =
          uploadLabel.trim() ||
          file.name.replace(/\.[^.]+$/, "") ||
          `Edit ${new Date().toLocaleDateString()}`;

        const footageRes = await fetch(`/api/creator/projects/${projectId}/footage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "EDIT", label, fileUrl }),
          signal: abort.signal,
        });
        const footageJson = await footageRes.json().catch(() => ({}));
        if (!footageRes.ok) {
          throw new Error((footageJson as { error?: string }).error || "Could not register edit");
        }
        const asset = (footageJson as { asset: EditFootageAsset }).asset;

        await createReviewMutation.mutateAsync({
          cutAssetId: asset.id,
          title: label,
        });

        void queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] });
        void queryClient.invalidateQueries({ queryKey: ["edit-review-playback", projectId] });
        setUploadLabel("");
      } catch (e) {
        console.error(e);
        const aborted =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && /abort|cancel/i.test(e.message));
        const message = aborted
          ? "Upload timed out or was cancelled. Try a smaller H.264 MP4."
          : e instanceof Error
            ? e.message
            : "Upload failed";
        setUploadError(message);
      } finally {
        window.clearTimeout(timeoutId);
        if (uploadAbortRef.current === abort) uploadAbortRef.current = null;
        setUploading(false);
        setUploadProgress(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [projectId, uploadLabel, createReviewMutation, queryClient],
  );

  const startReviewForEdit = useCallback(
    async (edit: EditFootageAsset) => {
      const existing = reviews.find((r) => r.cutAssetId === edit.id);
      if (existing) {
        setSelectedReviewId(existing.id);
        return;
      }
      await createReviewMutation.mutateAsync({
        cutAssetId: edit.id,
        title: edit.label || "Untitled edit",
      });
    },
    [reviews, createReviewMutation],
  );

  const sortedNotes = useMemo(() => {
    const notes = selectedReview?.notes ?? [];
    return [...notes].sort((a, b) => {
      const ta = a.timestampMs ?? Number.MAX_SAFE_INTEGER;
      const tb = b.timestampMs ?? Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  }, [selectedReview?.notes]);

  if (!hasProject || !projectId) {
    return (
      <div className="creator-tool-workspace">
        <header className="creator-tool-workspace-header">
          <p className="creator-tool-workspace-eyebrow">Post-production workspace</p>
          <h2 className="creator-tool-workspace-title">{title}</h2>
          <p className="creator-tool-workspace-description">
            Link a project to upload edit versions and run Frame.io-style timed review sessions.
          </p>
        </header>
      </div>
    );
  }

  if (reviewsLoading && footageLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64 bg-slate-800" />
        <Skeleton className="h-[420px] w-full bg-slate-800/60" />
      </div>
    );
  }

  return (
    <div className="edit-review-studio flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-black">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-orange-300/80">
            Edit review
          </p>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={uploadLabel}
            onChange={(e) => setUploadLabel(e.target.value)}
            placeholder="Version label (e.g. Rough Cut v2 · H.264 MP4)"
            className="h-8 w-52 border-white/10 bg-black/40 text-xs text-white md:w-64"
          />
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 bg-orange-500 text-white hover:bg-orange-600"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            {uploading
              ? uploadProgress != null
                ? `Uploading ${Math.round(uploadProgress)}%`
                : "Uploading…"
              : "Upload edit"}
          </Button>
          {uploading ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-slate-400 hover:text-white"
              onClick={() => uploadAbortRef.current?.abort()}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      {uploadError ? (
        <div className="flex items-center justify-between gap-3 border-b border-red-500/30 bg-red-950/40 px-4 py-2 text-xs text-red-200">
          <span>{uploadError}</span>
          <button
            type="button"
            className="shrink-0 text-red-300 underline hover:text-white"
            onClick={() => setUploadError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Asset sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-black md:w-64">
          <div className="border-b border-white/10 p-3">
            <p className="text-xs font-medium text-slate-400">Versions</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(["all", "IN_REVIEW", "NEEDS_CHANGES", "APPROVED"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] transition",
                    statusFilter === f
                      ? "bg-orange-500/20 text-orange-200"
                      : "text-slate-500 hover:text-slate-300",
                  )}
                >
                  {f === "all" ? "All" : f.replace(/_/g, " ").toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {filteredReviews.length === 0 && edits.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-500">
                Upload your first edit to start review.
              </p>
            ) : null}

            {filteredReviews.map((review) => {
              const active = review.id === selectedReviewId;
              const status = parseReviewStatus(review.status);
              return (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => setSelectedReviewId(review.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition",
                    active
                      ? "border-orange-400/40 bg-orange-500/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Film className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">
                        {review.title || review.cutAsset?.label || "Untitled edit"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {status.replace(/_/g, " ").toLowerCase()} · {review.notes.length} comments
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {edits
              .filter((e) => !reviews.some((r) => r.cutAssetId === e.id))
              .map((edit) => (
                <button
                  key={edit.id}
                  type="button"
                  onClick={() => void startReviewForEdit(edit)}
                  className="w-full rounded-lg border border-dashed border-white/15 px-3 py-2.5 text-left text-xs text-slate-400 hover:border-white/25 hover:text-slate-200"
                >
                  {edit.label || edit.id.slice(0, 8)} — start review
                </button>
              ))}
          </div>

          <div className="border-t border-white/10 p-3 text-[10px] text-slate-500">
            <Link
              href={`/creator/projects/${projectId}/post-production/footage-ingestion`}
              className="text-orange-400 hover:underline"
            >
              Footage ingestion →
            </Link>
          </div>
        </aside>

        {/* Player */}
        <main className="flex min-w-0 flex-1 flex-col border-r border-white/10 p-4">
          {selectedReview ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium text-white">
                    {selectedReview.title || selectedReview.cutAsset?.label || "Review"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedReview.notes.length} comment
                    {selectedReview.notes.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["IN_REVIEW", "NEEDS_CHANGES", "APPROVED"] as EditReviewStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        statusMutation.mutate({ id: selectedReview.id, status: s })
                      }
                      className={cn(
                        "rounded px-2 py-1 text-[10px] transition",
                        parseReviewStatus(selectedReview.status) === s
                          ? "bg-orange-500/25 text-orange-200"
                          : "bg-white/5 text-slate-400 hover:text-white",
                      )}
                    >
                      {s === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved
                        </span>
                      ) : (
                        s.replace(/_/g, " ").toLowerCase()
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {playbackPending && !playbackUrl ? (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/60 px-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-300" />
                  <p className="text-sm text-slate-400">Resolving playback…</p>
                </div>
              ) : playbackIsError && !playbackUrl ? (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-black/60 px-6 text-center">
                  <p className="max-w-md text-sm text-slate-300">
                    {playbackError instanceof Error
                      ? playbackError.message
                      : "Could not resolve playback"}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-orange-500 text-white hover:bg-orange-600"
                    onClick={() => void refetchPlayback()}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <EditReviewPlayer
                  ref={playerRef}
                  src={playbackUrl}
                  mimeType={playbackMime}
                  posterUrl={playbackPayload?.posterUrl}
                  statusMessage={playbackStatusMessage}
                  notes={sortedNotes}
                  onTimeUpdate={(ms) => setPlayheadMs(ms)}
                  onNoteMarkerClick={(note) => {
                    if (note.timestampMs != null) {
                      setPlayheadMs(note.timestampMs);
                    }
                  }}
                />
              )}
              {playbackPayload?.status === "encoding" || playbackPayload?.status === "failed" ? (
                <p className="mt-2 text-center text-[11px] text-amber-200/90">
                  Tip: export a web-friendly <span className="font-medium">H.264 MP4</span> from your
                  NLE for instant review while Stream finishes encoding masters.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Film className="mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">Select a version or upload a new edit</p>
            </div>
          )}
        </main>

        {/* Comments */}
        <aside className="flex w-72 shrink-0 flex-col bg-black md:w-80">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium text-white">Comments</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {sortedNotes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No comments yet. Play the cut and leave feedback at the playhead.
              </p>
            ) : (
              sortedNotes.map((note) => (
                <CommentCard
                  key={note.id}
                  note={note}
                  deleting={deleteNoteMutation.isPending && deleteNoteMutation.variables === note.id}
                  onSeek={() => {
                    if (note.timestampMs != null) {
                      playerRef.current?.seekToMs(note.timestampMs);
                      setPlayheadMs(note.timestampMs);
                    }
                  }}
                  onDelete={() => {
                    if (!window.confirm("Delete this comment?")) return;
                    deleteNoteMutation.mutate(note.id, {
                      onError: (err) => {
                        alert(err instanceof Error ? err.message : "Could not delete comment");
                      },
                    });
                  }}
                />
              ))
            )}
          </div>

          {selectedReview ? (
            <div className="border-t border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                <span>Comment at playhead</span>
                <span className="font-mono text-orange-300/90">
                  {formatReviewTimecode(playheadMs)}
                </span>
              </div>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Leave a comment…"
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-orange-400/40"
              />
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full bg-orange-500 text-white hover:bg-orange-600"
                disabled={!commentBody.trim() || noteMutation.isPending}
                onClick={() =>
                  noteMutation.mutate({
                    reviewId: selectedReview.id,
                    body: commentBody.trim(),
                    timestampMs: playheadMs,
                  })
                }
              >
                {noteMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                Add comment
              </Button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CommentCard({
  note,
  onSeek,
  onDelete,
  deleting,
}: {
  note: EditReviewNote;
  onSeek: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const initial = (note.user?.name?.[0] ?? "?").toUpperCase();
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onSeek}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-medium text-orange-200"
          title="Seek to comment"
        >
          {initial}
        </button>
        <button type="button" onClick={onSeek} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-200">
              {note.user?.name || "Collaborator"}
            </span>
            {note.timestampMs != null ? (
              <span className="font-mono text-[10px] text-orange-300">
                {formatReviewTimecode(note.timestampMs)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{note.body}</p>
        </button>
        <button
          type="button"
          title="Delete comment"
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded p-1.5 text-slate-500 transition hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
