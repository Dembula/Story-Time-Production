"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Film,
  Loader2,
  MessageSquare,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EditReviewPlayer, type EditReviewPlaybackHandle } from "./edit-review-player";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { resolveEditPlaybackUrl } from "@/lib/edit-review/playback";
import {
  formatReviewTimecode,
  parseReviewStatus,
  type EditFootageAsset,
  type EditReviewNote,
  type EditReviewSession,
  type EditReviewStatus,
} from "@/lib/edit-review/types";
import { cn } from "@/lib/utils";

const UPLOAD_ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-m4v,.mov,.mp4,.mxf";

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
  const hasProject = !!projectId;

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [playheadMs, setPlayheadMs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EditReviewStatus>("all");

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["project-reviews", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/reviews`),
    enabled: hasProject,
  });

  const { data: footageData, isLoading: footageLoading } = useQuery({
    queryKey: ["project-footage", projectId, "EDIT"],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/footage?type=EDIT`),
    enabled: hasProject,
  });

  const reviews = (reviewsData?.reviews ?? []) as EditReviewSession[];
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

  const playbackUrl = useMemo(() => {
    if (!selectedReview?.cutAsset || !projectId) return null;
    return resolveEditPlaybackUrl(selectedReview.cutAsset, projectId);
  }, [selectedReview, projectId]);

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

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !projectId) return;
      const file = files[0]!;
      setUploading(true);
      try {
        const fileUrl = await uploadContentMediaViaApi(file);
        const label =
          uploadLabel.trim() ||
          file.name.replace(/\.[^.]+$/, "") ||
          `Edit ${new Date().toLocaleDateString()}`;

        const footageRes = await fetch(`/api/creator/projects/${projectId}/footage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "EDIT", label, fileUrl }),
        });
        const footageJson = await footageRes.json().catch(() => ({}));
        if (!footageRes.ok) {
          throw new Error((footageJson as { error?: string }).error || "Upload failed");
        }
        const asset = (footageJson as { asset: EditFootageAsset }).asset;

        await createReviewMutation.mutateAsync({
          cutAssetId: asset.id,
          title: label,
        });

        void queryClient.invalidateQueries({ queryKey: ["project-footage", projectId] });
        setUploadLabel("");
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
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
    <div className="edit-review-studio flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#08080c]">
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
            placeholder="Version label (e.g. Rough Cut v2)"
            className="h-8 w-44 border-white/10 bg-black/40 text-xs text-white md:w-56"
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
            Upload edit
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Asset sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-[#0a0a0e] md:w-64">
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

              <EditReviewPlayer
                ref={playerRef}
                src={playbackUrl}
                notes={sortedNotes}
                onTimeUpdate={(ms) => setPlayheadMs(ms)}
                onNoteMarkerClick={(note) => {
                  if (note.timestampMs != null) setPlayheadMs(note.timestampMs);
                }}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Film className="mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">Select a version or upload a new edit</p>
            </div>
          )}
        </main>

        {/* Comments */}
        <aside className="flex w-72 shrink-0 flex-col bg-[#0c0c10] md:w-80">
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
                  onSeek={() => {
                    if (note.timestampMs != null) {
                      playerRef.current?.seekToMs(note.timestampMs);
                      setPlayheadMs(note.timestampMs);
                    }
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
}: {
  note: EditReviewNote;
  onSeek: () => void;
}) {
  const initial = (note.user?.name?.[0] ?? "?").toUpperCase();
  return (
    <button
      type="button"
      onClick={onSeek}
      className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/20"
    >
      <div className="flex items-start gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-medium text-orange-200">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
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
        </div>
      </div>
    </button>
  );
}
