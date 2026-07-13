"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Film,
  Loader2,
  Send,
  Shield,
  Tv,
} from "lucide-react";
import { StoryTimeLoader } from "@/components/ui/storytime-loader";
import {
  SeriesEpisodesUpload,
  buildSeasonsPayload,
  type EpisodeDraft,
} from "@/components/creator/series-episodes-upload";
import { contentTypeLabel, isLongFormType } from "@/lib/content-types";
import { useCatalogueUpload } from "@/components/creator/catalogue-upload-provider";

type SeriesInfo = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  reviewStatus: string;
  nextSeasonNumber: number;
  canAddSeason: boolean;
  seasons: Array<{
    seasonNumber: number;
    title: string | null;
    published: boolean;
    _count: { episodes: number };
  }>;
};

function AddSeasonInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ensureJob, enqueueAsset, updateJobMeta, jobs } = useCatalogueUpload();
  const contentId = searchParams.get("contentId") ?? "";
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [episodeCount, setEpisodeCount] = useState(6);
  const [episodeDrafts, setEpisodeDrafts] = useState<EpisodeDraft[]>([]);
  const [seasonTitle, setSeasonTitle] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const jobId = ensureJob({
      contentId: contentId || null,
      title: seasonTitle || "New season",
    });
    setUploadJobId(jobId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!uploadJobId) return;
    updateJobMeta(uploadJobId, {
      title: seasonTitle.trim() || series?.title || "New season",
      contentId: contentId || null,
    });
  }, [uploadJobId, seasonTitle, series?.title, contentId, updateJobMeta]);

  useEffect(() => {
    if (!uploadJobId) return;
    const job = jobs.find((j) => j.id === uploadJobId);
    if (!job) return;
    for (const asset of job.assets) {
      if (
        asset.kind === "episode" &&
        asset.status === "complete" &&
        asset.storageUrl &&
        asset.meta?.seasonNumber != null &&
        asset.meta?.episodeNumber != null
      ) {
        const s = asset.meta.seasonNumber;
        const e = asset.meta.episodeNumber;
        const url = asset.storageUrl;
        setEpisodeDrafts((prev) =>
          prev.map((ep) =>
            ep.seasonNumber === s && ep.episodeNumber === e && ep.videoUrl !== url
              ? { ...ep, videoUrl: url }
              : ep,
          ),
        );
      }
    }
  }, [jobs, uploadJobId]);

  useEffect(() => {
    if (!contentId) {
      setLoading(false);
      setError("No series selected. Open this page from your content list.");
      return;
    }
    fetch(`/api/creator/content/${contentId}/seasons`)
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error ?? "Failed to load")))))
      .then((data: SeriesInfo) => {
        setSeries(data);
        setSeasonTitle(`Season ${data.nextSeasonNumber}`);
        if (!data.canAddSeason) {
          setError("This series must be published before you can add a new season.");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load series"))
      .finally(() => setLoading(false));
  }, [contentId]);

  useEffect(() => {
    if (!series) return;
    const s = series.nextSeasonNumber;
    const drafts: EpisodeDraft[] = [];
    for (let e = 1; e <= episodeCount; e++) {
      drafts.push({
        seasonNumber: s,
        episodeNumber: e,
        title: `Episode ${e}`,
        description: "",
        videoUrl: "",
        duration: "",
      });
    }
    setEpisodeDrafts(drafts);
  }, [series, episodeCount]);

  async function handleSubmit() {
    if (!series || !confirmed) return;
    setError("");
    setSubmitting(true);
    try {
      const payload = buildSeasonsPayload(episodeDrafts);
      const season = payload[0];
      if (!season) throw new Error("Add at least one episode");

      const res = await fetch(`/api/creator/content/${series.id}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonTitle: seasonTitle.trim() || `Season ${series.nextSeasonNumber}`,
          episodes: season.episodes,
          deliveryNotes: deliveryNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSuccess(true);
      setTimeout(() => router.push("/creator/catalogue"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-400" />
        <h1 className="font-display text-2xl font-semibold text-white">Season submitted</h1>
        <p className="mt-2 text-slate-400">
          Your new season is in review. Existing seasons stay live for viewers until approval completes.
        </p>
      </div>
    );
  }

  if (!series || error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-red-300">{error || "Series not found"}</p>
        <Link href="/creator/dashboard" className="mt-6 inline-block text-orange-400 hover:text-orange-300">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const allEpisodesReady = episodeDrafts.length > 0 && episodeDrafts.every((e) => e.videoUrl.trim());

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-12">
      <Link
        href="/creator/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="mb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Add to series</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-2xl font-semibold text-white md:text-3xl">
          <Tv className="h-8 w-8 text-orange-400" />
          New Season
        </h1>
        <p className="mt-2 text-slate-400">
          Adding to <span className="font-medium text-white">{series.title}</span> ·{" "}
          {contentTypeLabel(series.type)}
        </p>
      </header>

      {error && step > 1 && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-white">Season {series.nextSeasonNumber}</h2>
            <p className="mt-2 text-sm text-slate-400">
              You&apos;re extending an existing series. Viewers will keep access to published seasons while this
              season is reviewed.
            </p>
            {series.seasons.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">On Story Time now</p>
                {series.seasons.map((s) => (
                  <div key={s.seasonNumber} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-sm">
                    <span className="text-slate-300">{s.title ?? `Season ${s.seasonNumber}`}</span>
                    <span className="text-slate-500">{s._count.episodes} episodes · {s.published ? "Live" : "Pending"}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5">
              <label className="mb-1.5 block text-xs text-slate-400">Season title (optional)</label>
              <input
                value={seasonTitle}
                onChange={(e) => setSeasonTitle(e.target.value)}
                placeholder={`Season ${series.nextSeasonNumber}`}
                className="storytime-input w-full rounded-xl px-4 py-3 text-sm text-white"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600"
          >
            Continue to episodes <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">How many episodes in this season?</label>
            <select
              value={episodeCount}
              onChange={(e) => setEpisodeCount(Number(e.target.value))}
              className="storytime-select w-full max-w-xs rounded-xl px-4 py-3 text-sm text-white"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} episode{n !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>

          <SeriesEpisodesUpload
            mode="singleSeason"
            fixedSeasonNumber={series.nextSeasonNumber}
            seasonCount={1}
            episodesPerSeason={[episodeCount]}
            episodes={episodeDrafts}
            onSeasonCountChange={() => {}}
            onEpisodesPerSeasonChange={() => {}}
            onEpisodesChange={setEpisodeDrafts}
            onError={setError}
            onUploadEpisode={(seasonNumber, episodeNumber, file) => {
              const jobId =
                uploadJobId ??
                ensureJob({
                  contentId,
                  title: seasonTitle || series.title,
                });
              if (!uploadJobId) setUploadJobId(jobId);
              enqueueAsset({
                jobId,
                kind: "episode",
                label: `S${seasonNumber}E${episodeNumber}`,
                file,
                meta: { seasonNumber, episodeNumber },
              });
            }}
            episodeUploadProgress={(seasonNumber, episodeNumber) => {
              const asset = uploadJobId
                ? jobs
                    .find((j) => j.id === uploadJobId)
                    ?.assets.find(
                      (a) =>
                        a.kind === "episode" &&
                        a.meta?.seasonNumber === seasonNumber &&
                        a.meta?.episodeNumber === episodeNumber,
                    )
                : undefined;
              return {
                uploading: asset?.status === "queued" || asset?.status === "uploading",
                progress: asset?.progress ?? null,
              };
            }}
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!allEpisodesReady}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              Review & submit <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-white">Review submission</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Series</dt>
                <dd className="text-white">{series.title}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">New season</dt>
                <dd className="text-white">{seasonTitle || `Season ${series.nextSeasonNumber}`}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Episodes</dt>
                <dd className="text-white">{episodeDrafts.length}</dd>
              </div>
            </dl>
            <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-400">
              {episodeDrafts.map((ep) => (
                <li key={ep.episodeNumber} className="flex items-center gap-2">
                  <Film className="h-3 w-3 shrink-0 text-orange-400" />
                  E{ep.episodeNumber}: {ep.title}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Delivery notes (optional)</label>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              rows={3}
              className="storytime-input w-full rounded-xl px-4 py-3 text-sm text-white"
              placeholder="Anything the review team should know about this season…"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange-400/20 bg-orange-500/5 p-4">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-slate-300">
              <Shield className="mb-1 inline h-4 w-4 text-orange-400" /> I confirm I have rights to distribute
              this season and all episode masters are final.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !confirmed}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit season for review
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddSeasonPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <StoryTimeLoader size="sm" hideTrack />
        </div>
      }
    >
      <AddSeasonInner />
    </Suspense>
  );
}
