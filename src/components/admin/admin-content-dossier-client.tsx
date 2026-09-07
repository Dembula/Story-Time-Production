"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  Eye,
  Film,
  MessageSquare,
  Play,
  Star,
  Users,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { AdminReviewPlayer } from "@/components/admin/admin-review-player";
import { AdminEncodeProgress } from "@/components/admin/admin-encode-progress";
import {
  REVIEW_CTA_PRESET_TEMPLATES,
  resolveCtaPresetPath,
  parseReviewFeedback,
  type ReviewFeedbackKind,
} from "@/lib/review-feedback";

type TabId = "media" | "engagement" | "encode" | "review";

type Dossier = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  videoUrl: string | null;
  trailerUrl: string | null;
  scriptUrl: string | null;
  reviewStatus: string;
  reviewNote: string | null;
  reviewFeedback?: unknown;
  featured: boolean;
  published: boolean;
  ageRating: string | null;
  language: string | null;
  duration: number | null;
  year: number | null;
  creator: { id: string; name: string | null; email: string | null; isAfdaStudent: boolean };
  linkedProject?: { id: string; title: string } | null;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    title: string | null;
    episodes: Array<{
      id: string;
      episodeNumber: number;
      title: string;
      description: string | null;
      videoUrl: string | null;
      thumbnailUrl: string | null;
      duration: number | null;
    }>;
  }>;
  btsVideos: Array<{ id: string; title: string; videoUrl: string | null; thumbnail: string | null }>;
  crewMembers: Array<{ id: string; name: string; role: string }>;
  ratings: Array<{
    id: string;
    score: number;
    createdAt: string;
    user: { id: string; name: string | null; email: string | null };
  }>;
  ratingAverage: number | null;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string | null; email: string | null };
    replies: Array<{
      id: string;
      body: string;
      createdAt: string;
      user: { id: string; name: string | null; email: string | null };
    }>;
  }>;
  recentWatches: Array<{
    id: string;
    startedAt: string;
    durationSeconds: number;
    user: { id: string; name: string | null; email: string | null };
  }>;
  _count: {
    watchSessions: number;
    ratings: number;
    comments: number;
    crewMembers: number;
    btsVideos: number;
  };
  mediaChecklist: {
    missing: string[];
    playable: boolean;
    firstEpisodeId: string | null;
    requirements: { longForm: boolean };
    rows: Array<{ label: string; status: string; detail?: string; url?: string | null }>;
    episodeStats: { total: number; withMaster: number };
  };
};

export function AdminContentDossierClient() {
  const params = useParams();
  const contentId = String(params.id || "");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("media");
  const [preview, setPreview] = useState<{
    trailer?: boolean;
    episodeId?: string | null;
    btsUrl?: string | null;
  } | null>(null);
  const [note, setNote] = useState("");
  const [feedbackRows, setFeedbackRows] = useState<
    Array<{ kind: ReviewFeedbackKind; message: string; presetPath: string }>
  >([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const dossierQuery = useQuery({
    queryKey: ["admin-content-dossier", contentId],
    enabled: Boolean(contentId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/content/${contentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load content");
      return json as Dossier;
    },
  });

  const dossier = dossierQuery.data;

  useEffect(() => {
    if (!dossier) return;
    setNote(dossier.reviewNote || "");
    const parsed = parseReviewFeedback(dossier.reviewFeedback);
    setFeedbackRows(
      parsed.map((p) => ({
        kind: p.kind,
        message: p.message,
        presetPath:
          REVIEW_CTA_PRESET_TEMPLATES.find(
            (t) => resolveCtaPresetPath(t.path, dossier.linkedProject?.id ?? null) === p.ctaPath,
          )?.path ?? "",
      })),
    );
  }, [dossier?.id]);

  const reviewMutation = useMutation({
    mutationFn: async (payload: { action: string; featured?: boolean }) => {
      const res = await fetch("/api/admin/content/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId,
          action: payload.action,
          reviewNote: note,
          reviewFeedback: feedbackRows
            .filter((r) => r.message.trim())
            .map((r) => ({
              kind: r.kind,
              message: r.message,
              ctaPath: resolveCtaPresetPath(r.presetPath, dossier?.linkedProject?.id ?? null),
            })),
          featured: payload.featured === true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Review action failed");
      return json;
    },
    onSuccess: async (_data, payload) => {
      setActionMsg(`Action ${payload.action} completed.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-content-dossier", contentId] });
    },
    onError: (err: Error) => setActionMsg(err.message),
  });

  if (dossierQuery.isLoading) return <StoryTimeLoadingCenter />;
  if (dossierQuery.error || !dossier) {
    return (
      <div className="space-y-4 text-slate-100">
        <Link href="/admin/content" className="inline-flex items-center gap-2 text-sm text-orange-300">
          <ArrowLeft className="h-4 w-4" /> Back to content
        </Link>
        <p className="text-rose-300">{(dossierQuery.error as Error)?.message || "Not found"}</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "media", label: "Media" },
    { id: "engagement", label: "Engagement" },
    { id: "encode", label: "Encode" },
    { id: "review", label: "Review" },
  ];

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/content" className="inline-flex items-center gap-2 text-sm text-orange-300 hover:text-orange-200">
          <ArrowLeft className="h-4 w-4" /> Content queue
        </Link>
      </div>

      <header className="storytime-plan-card overflow-hidden">
        <div className="relative min-h-[180px]">
          {dossier.backdropUrl || dossier.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dossier.backdropUrl || dossier.posterUrl || ""}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
          )}
          <div className="relative flex flex-wrap gap-4 p-5 md:p-6">
            {dossier.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dossier.posterUrl} alt="" className="h-36 w-24 rounded-lg object-cover shadow-lg" />
            ) : (
              <div className="flex h-36 w-24 items-center justify-center rounded-lg bg-slate-800">
                <Film className="h-8 w-8 text-slate-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-white">{dossier.title}</h1>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{dossier.type}</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
                  {dossier.reviewStatus}
                </span>
                {dossier.featured ? (
                  <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300">Featured</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-300">
                by {dossier.creator.name || dossier.creator.email}
                {dossier.language ? ` · ${dossier.language}` : ""}
                {dossier.year ? ` · ${dossier.year}` : ""}
                {dossier.ageRating ? ` · ${dossier.ageRating}` : ""}
              </p>
              <p className="mt-3 max-w-3xl text-sm text-slate-400 line-clamp-3">{dossier.description || "No synopsis."}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {dossier._count.watchSessions} watches
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" /> {dossier.ratingAverage ?? "—"} ({dossier._count.ratings})
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> {dossier._count.comments}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {dossier._count.crewMembers} crew
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                tab === t.id
                  ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <p className="text-sm text-white">
                {preview.btsUrl
                  ? "BTS preview"
                  : preview.trailer
                    ? "Trailer"
                    : preview.episodeId
                      ? "Episode"
                      : "Main"}
              </p>
              <button type="button" className="text-slate-400 hover:text-white" onClick={() => setPreview(null)}>
                ✕
              </button>
            </div>
            <div className="aspect-video bg-black">
              {preview.btsUrl ? (
                <video src={preview.btsUrl} controls autoPlay className="h-full w-full" />
              ) : (
                <AdminReviewPlayer
                  contentId={dossier.id}
                  trailer={Boolean(preview.trailer)}
                  episodeId={preview.episodeId || undefined}
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "media" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="storytime-plan-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">Catalogue checklist</h2>
            {dossier.mediaChecklist.missing.length > 0 ? (
              <p className="text-xs text-amber-300">Missing: {dossier.mediaChecklist.missing.join("; ")}</p>
            ) : (
              <p className="text-xs text-emerald-400">Ready for publish (media requirements).</p>
            )}
            <ul className="space-y-2 text-sm">
              {dossier.mediaChecklist.rows.map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      row.status === "ok" ? "bg-emerald-400" : row.status === "missing" ? "bg-rose-400" : "bg-slate-500"
                    }`}
                  />
                  <span className="text-slate-300">{row.label}</span>
                  <span className="text-xs text-slate-500">{row.detail || row.status}</span>
                </li>
              ))}
            </ul>
            {dossier.mediaChecklist.playable ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500/15 px-3 py-2 text-sm text-orange-200"
                onClick={() =>
                  setPreview({
                    trailer: false,
                    episodeId: dossier.mediaChecklist.requirements.longForm
                      ? dossier.mediaChecklist.firstEpisodeId
                      : null,
                  })
                }
              >
                <Play className="h-4 w-4" /> Watch primary
              </button>
            ) : null}
            {dossier.trailerUrl ? (
              <button
                type="button"
                className="ml-2 inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200"
                onClick={() => setPreview({ trailer: true })}
              >
                Trailer
              </button>
            ) : null}
          </div>

          <div className="storytime-plan-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">
              Episodes ({dossier.mediaChecklist.episodeStats.withMaster}/{dossier.mediaChecklist.episodeStats.total} masters)
            </h2>
            {dossier.seasons.length === 0 ? (
              <p className="text-sm text-slate-500">
                {dossier.mediaChecklist.requirements.longForm
                  ? "No seasons uploaded yet."
                  : "Single-title — no episode tree."}
              </p>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {dossier.seasons.map((season) => (
                  <div key={season.id}>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Season {season.seasonNumber}
                      {season.title ? ` · ${season.title}` : ""}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {season.episodes.map((ep) => (
                        <li
                          key={ep.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-white">
                              E{ep.episodeNumber}. {ep.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {ep.videoUrl ? "Master uploaded" : "Missing master"}
                              {ep.duration ? ` · ${ep.duration}m` : ""}
                            </p>
                          </div>
                          {ep.videoUrl ? (
                            <button
                              type="button"
                              className="shrink-0 rounded-lg bg-orange-500/15 p-2 text-orange-200"
                              onClick={() => setPreview({ episodeId: ep.id })}
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="storytime-plan-card space-y-3 p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Behind the scenes ({dossier.btsVideos.length})</h2>
            {dossier.btsVideos.length === 0 ? (
              <p className="text-sm text-slate-500">No BTS videos.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {dossier.btsVideos.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 text-sm">
                    <span className="truncate text-slate-200">{b.title}</span>
                    {b.videoUrl ? (
                      <button
                        type="button"
                        className="text-orange-300"
                        onClick={() => setPreview({ btsUrl: b.videoUrl })}
                      >
                        Watch
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No URL</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {dossier.crewMembers.length > 0 ? (
              <div className="pt-2">
                <h3 className="text-xs font-medium uppercase text-slate-500">Cast & crew</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {dossier.crewMembers.map((cm) => (
                    <span key={cm.id} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                      {cm.name} — <span className="text-orange-300">{cm.role}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "engagement" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="storytime-plan-card p-4">
            <h2 className="text-sm font-semibold text-white">
              Ratings · avg {dossier.ratingAverage ?? "—"} ({dossier._count.ratings})
            </h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
              {dossier.ratings.length === 0 ? (
                <li className="text-slate-500">No ratings yet.</li>
              ) : (
                dossier.ratings.map((r) => (
                  <li key={r.id} className="rounded-lg border border-white/5 px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="text-white">{r.user.name || r.user.email}</span>
                      <span className="text-amber-300">{r.score}/5</span>
                    </div>
                    <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="storytime-plan-card p-4">
            <h2 className="text-sm font-semibold text-white">Comments ({dossier._count.comments})</h2>
            <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto text-sm">
              {dossier.comments.length === 0 ? (
                <li className="text-slate-500">No comments yet.</li>
              ) : (
                dossier.comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-white/5 px-3 py-2">
                    <p className="text-xs text-slate-500">
                      {c.user.name || c.user.email} · {new Date(c.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-slate-200">{c.body}</p>
                    {c.replies.map((r) => (
                      <div key={r.id} className="mt-2 border-l border-white/10 pl-3 text-xs text-slate-400">
                        <p className="text-slate-500">{r.user.name || r.user.email}</p>
                        <p>{r.body}</p>
                      </div>
                    ))}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="storytime-plan-card p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Recent watches</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
              {dossier.recentWatches.length === 0 ? (
                <li className="text-slate-500">No watch sessions.</li>
              ) : (
                dossier.recentWatches.map((w) => (
                  <li key={w.id} className="rounded-lg border border-white/5 px-3 py-2">
                    <p className="text-white">{w.user.name || w.user.email}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(w.startedAt).toLocaleString()} · {Math.round(w.durationSeconds / 60)} min
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      ) : null}

      {tab === "encode" ? (
        <section className="storytime-plan-card p-4">
          <h2 className="text-sm font-semibold text-white">Encode status</h2>
          <p className="mt-1 text-xs text-slate-500">Main, trailer, and episode masters.</p>
          <div className="mt-4">
            <AdminEncodeProgress contentId={dossier.id} />
          </div>
        </section>
      ) : null}

      {tab === "review" ? (
        <section className="storytime-plan-card space-y-4 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-white">Review decision</h2>
          {dossier.mediaChecklist.missing.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Approve will be blocked until: {dossier.mediaChecklist.missing.join("; ")}
            </div>
          ) : null}
          <label className="block text-xs text-slate-400">
            Review note
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() => {
                setActionMsg(null);
                reviewMutation.mutate({ action: "APPROVE" });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200"
            >
              <CheckCircle className="h-4 w-4" /> Approve & publish
            </button>
            <button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() => {
                setActionMsg(null);
                reviewMutation.mutate({ action: "APPROVE", featured: true });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500/15 px-3 py-2 text-sm text-yellow-200"
            >
              <Star className="h-4 w-4" /> Approve & feature
            </button>
            <button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() => {
                setActionMsg(null);
                reviewMutation.mutate({ action: "REQUEST_CHANGES" });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500/15 px-3 py-2 text-sm text-orange-200"
            >
              <AlertTriangle className="h-4 w-4" /> Request changes
            </button>
            <button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() => {
                setActionMsg(null);
                reviewMutation.mutate({ action: "REJECT" });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </div>
          {actionMsg ? <p className="text-xs text-slate-300">{actionMsg}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
