"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deleteContentMediaFromStorage,
  preferredStorageReference,
  uploadContentMediaViaApiFull,
} from "@/lib/upload-content-media-client";
import {
  deriveCatalogueJobStatus,
  dedupeCatalogueJobs,
  isJobInFlight,
  isJobVisibleInBell,
  jobOverallProgress,
  jobsMatchCatalogueIdentity,
  MAX_CONCURRENT_JOBS,
  MAX_CONCURRENT_XHR,
  type CatalogueAssetKind,
  type CatalogueUploadAsset,
  type CatalogueUploadJob,
} from "@/lib/catalogue-upload/types";

type AssetFileEntry = {
  file: File;
  abort: AbortController;
};

function deleteStorageBestEffort(storageUrl: string | null | undefined) {
  const value = storageUrl?.trim();
  if (!value) return;
  void deleteContentMediaFromStorage(value);
}

type EnqueueAssetInput = {
  jobId: string;
  kind: CatalogueAssetKind;
  label: string;
  file: File;
  assetId?: string;
  meta?: CatalogueUploadAsset["meta"];
};

type EnsureJobInput = {
  jobId?: string;
  title?: string;
  contentId?: string | null;
  linkedProjectId?: string | null;
};

type FinalizeResult = {
  ok: boolean;
  deferred?: boolean;
  contentId?: string;
  requiresPayment?: boolean;
  checkoutUrl?: string;
  reviewStatus?: string;
  error?: string;
};

type CatalogueUploadContextValue = {
  jobs: CatalogueUploadJob[];
  activeJobs: CatalogueUploadJob[];
  ensureJob: (input?: EnsureJobInput) => string;
  findJob: (identity: { contentId?: string | null; title?: string | null; jobId?: string | null }) => CatalogueUploadJob | null;
  updateJobMeta: (
    jobId: string,
    patch: Partial<Pick<CatalogueUploadJob, "title" | "contentId" | "linkedProjectId">>,
  ) => void;
  enqueueAsset: (input: EnqueueAssetInput) => string;
  removeAsset: (
    jobId: string,
    kind: CatalogueAssetKind,
    meta?: CatalogueUploadAsset["meta"],
  ) => void;
  getAsset: (jobId: string, assetId: string) => CatalogueUploadAsset | undefined;
  getAssetByKind: (
    jobId: string,
    kind: CatalogueAssetKind,
    meta?: CatalogueUploadAsset["meta"],
  ) => CatalogueUploadAsset | undefined;
  cancelJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  requestFinalize: (jobId: string, payload: Record<string, unknown>) => Promise<FinalizeResult>;
  patchFormUrlsFromJob: (jobId: string) => Record<string, unknown>;
};

const CatalogueUploadContext = createContext<CatalogueUploadContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function assetMatchesMeta(
  asset: CatalogueUploadAsset,
  kind: CatalogueAssetKind,
  meta?: CatalogueUploadAsset["meta"],
): boolean {
  if (asset.kind !== kind) return false;
  if (!meta) return true;
  if (meta.seasonNumber != null && asset.meta?.seasonNumber !== meta.seasonNumber) return false;
  if (meta.episodeNumber != null && asset.meta?.episodeNumber !== meta.episodeNumber) return false;
  if (meta.btsIndex != null && asset.meta?.btsIndex !== meta.btsIndex) return false;
  return true;
}

async function notifyUploadEvent(body: {
  type: "CONTENT_UPLOAD_COMPLETE" | "CONTENT_UPLOAD_FAILED";
  title: string;
  body: string;
  contentId?: string | null;
  url?: string;
}): Promise<void> {
  await fetch("/api/creator/catalogue-upload/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

export function CatalogueUploadProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobsState] = useState<CatalogueUploadJob[]>([]);
  const jobsRef = useRef(jobs);
  const filesRef = useRef<Map<string, AssetFileEntry>>(new Map());
  /** Prevents the same asset from being started twice when pump re-runs before React commits. */
  const inFlightAssetIdsRef = useRef<Set<string>>(new Set());
  const activeXhrRef = useRef(0);
  const pumpRef = useRef<() => void>(() => {});

  const setJobs = useCallback((updater: CatalogueUploadJob[] | ((prev: CatalogueUploadJob[]) => CatalogueUploadJob[])) => {
    setJobsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      jobsRef.current = next;
      return next;
    });
  }, []);

  const setJob = useCallback((jobId: string, updater: (job: CatalogueUploadJob) => CatalogueUploadJob) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? updater(j) : j)));
  }, [setJobs]);

  const findJob = useCallback(
    (identity: { contentId?: string | null; title?: string | null; jobId?: string | null }) => {
      if (identity.jobId) {
        const byId = jobsRef.current.find((j) => j.id === identity.jobId);
        if (byId) return byId;
      }
      const ranked = [...jobsRef.current]
        .filter((j) => j.status !== "cancelled")
        .sort((a, b) => {
          const aLive = isJobInFlight(a) ? 1 : 0;
          const bLive = isJobInFlight(b) ? 1 : 0;
          if (aLive !== bLive) return bLive - aLive;
          return b.updatedAt - a.updatedAt;
        });
      return ranked.find((j) => jobsMatchCatalogueIdentity(j, identity)) ?? null;
    },
    [],
  );

  const ensureJob = useCallback((input?: EnsureJobInput): string => {
    const existingId = input?.jobId;
    if (existingId) {
      const found = jobsRef.current.find((j) => j.id === existingId);
      if (found) {
        if (input?.title || input?.contentId !== undefined || input?.linkedProjectId !== undefined) {
          setJob(existingId, (j) => ({
            ...j,
            title: input.title?.trim() || j.title,
            contentId: input.contentId !== undefined ? input.contentId : j.contentId,
            linkedProjectId:
              input.linkedProjectId !== undefined ? input.linkedProjectId : j.linkedProjectId,
            updatedAt: Date.now(),
          }));
        }
        return existingId;
      }
    }

    const matched = findJob({
      contentId: input?.contentId,
      title: input?.title,
    });
    if (matched) {
      if (input?.title || input?.contentId !== undefined || input?.linkedProjectId !== undefined) {
        setJob(matched.id, (j) => ({
          ...j,
          title: input.title?.trim() || j.title,
          contentId: input.contentId !== undefined ? input.contentId ?? j.contentId : j.contentId,
          linkedProjectId:
            input.linkedProjectId !== undefined ? input.linkedProjectId : j.linkedProjectId,
          updatedAt: Date.now(),
        }));
      }
      // Collapse empty/stale duplicate shells for the same title/content
      setJobs((prev) =>
        prev.filter((j) => {
          if (j.id === matched.id) return true;
          if (!jobsMatchCatalogueIdentity(j, { contentId: matched.contentId, title: matched.title })) {
            return true;
          }
          if (isJobInFlight(j)) return true;
          return j.assets.some((a) => a.status === "failed" || a.status === "complete");
        }),
      );
      return matched.id;
    }

    const inFlightCount = jobsRef.current.filter(isJobInFlight).length;
    if (inFlightCount >= MAX_CONCURRENT_JOBS) {
      const oldest = jobsRef.current.find(isJobInFlight);
      if (oldest) return oldest.id;
    }

    const id = existingId || newId("job");
    const now = Date.now();
    const job: CatalogueUploadJob = {
      id,
      title: input?.title?.trim() || "Untitled draft",
      contentId: input?.contentId ?? null,
      linkedProjectId: input?.linkedProjectId ?? null,
      status: "queued",
      assets: [],
      error: null,
      createdAt: now,
      updatedAt: now,
      finalizeWhenReady: false,
      finalizePayload: null,
    };
    setJobs((prev) => [job, ...prev]);
    return id;
  }, [findJob, setJob]);

  const updateJobMeta = useCallback(
    (
      jobId: string,
      patch: Partial<Pick<CatalogueUploadJob, "title" | "contentId" | "linkedProjectId">>,
    ) => {
      setJob(jobId, (j) => ({ ...j, ...patch, updatedAt: Date.now() }));
    },
    [setJob],
  );

  const cancelJob = useCallback((jobId: string) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return;
    for (const asset of job.assets) {
      const entry = filesRef.current.get(asset.id);
      entry?.abort.abort();
      filesRef.current.delete(asset.id);
      inFlightAssetIdsRef.current.delete(asset.id);
    }
    setJob(jobId, (j) => ({
      ...j,
      status: "cancelled",
      updatedAt: Date.now(),
      finalizeWhenReady: false,
      finalizePayload: null,
      assets: j.assets.map((a) =>
        a.status === "queued" || a.status === "uploading"
          ? { ...a, status: "cancelled", error: "Cancelled" }
          : a,
      ),
    }));
  }, [setJob]);

  const dismissJob = useCallback((jobId: string) => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (job && isJobInFlight(job)) {
      cancelJob(jobId);
    }
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }, [cancelJob]);

  const removeAsset = useCallback(
    (jobId: string, kind: CatalogueAssetKind, meta?: CatalogueUploadAsset["meta"]) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;
      const target = job.assets.find((a) => assetMatchesMeta(a, kind, meta));
      if (!target) return;
      if (target.status === "queued" || target.status === "uploading") {
        filesRef.current.get(target.id)?.abort.abort();
        filesRef.current.delete(target.id);
        inFlightAssetIdsRef.current.delete(target.id);
      }
      // Drop completed objects from S3 so replace/remove does not leave orphans.
      if (target.status === "complete") {
        deleteStorageBestEffort(target.storageUrl);
      }
      setJob(jobId, (j) => {
        const assets = j.assets.filter((a) => a.id !== target.id);
        const next: CatalogueUploadJob = {
          ...j,
          assets,
          error: null,
          updatedAt: Date.now(),
          finalizeWhenReady: j.finalizeWhenReady,
          status: j.status,
        };
        next.status = deriveCatalogueJobStatus(next);
        return next;
      });
      queueMicrotask(() => pumpRef.current());
    },
    [setJob],
  );

  const patchFormUrlsFromJob = useCallback((jobId: string): Record<string, unknown> => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job) return {};
    const patch: Record<string, unknown> = {};
    for (const asset of job.assets) {
      if (asset.status !== "complete" || !asset.storageUrl) continue;
      if (asset.kind === "mainVideo") patch.videoUrl = asset.storageUrl;
      if (asset.kind === "trailer") patch.trailerUrl = asset.storageUrl;
      if (asset.kind === "poster") patch.posterUrl = asset.storageUrl;
      if (asset.kind === "backdrop") patch.backdropUrl = asset.storageUrl;
      if (asset.kind === "script") patch.scriptUrl = asset.storageUrl;
    }
    return patch;
  }, []);

  const runFinalize = useCallback(
    async (jobId: string): Promise<FinalizeResult> => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job?.finalizePayload) {
        return { ok: false, error: "Missing finalize payload" };
      }

      const urlPatch = patchFormUrlsFromJob(jobId);
      const payload: Record<string, unknown> = {
        ...job.finalizePayload,
        ...urlPatch,
      };

      // Patch episode / BTS URLs into payload when present
      if (Array.isArray(payload.seasons)) {
        const seasons = payload.seasons as Array<{
          episodes?: Array<{ seasonNumber?: number; episodeNumber?: number; videoUrl?: string }>;
        }>;
        for (const season of seasons) {
          for (const ep of season.episodes ?? []) {
            const asset = job.assets.find(
              (a) =>
                a.kind === "episode" &&
                a.status === "complete" &&
                a.meta?.seasonNumber === ep.seasonNumber &&
                a.meta?.episodeNumber === ep.episodeNumber &&
                a.storageUrl,
            );
            if (asset?.storageUrl) ep.videoUrl = asset.storageUrl;
          }
        }
      }
      if (Array.isArray(payload.btsVideos)) {
        const bts = payload.btsVideos as Array<{ title?: string; videoUrl?: string }>;
        job.assets
          .filter((a) => a.kind === "bts" && a.status === "complete" && a.storageUrl)
          .forEach((a) => {
            const idx = a.meta?.btsIndex;
            if (idx != null && bts[idx]) bts[idx].videoUrl = a.storageUrl!;
          });
      }

      if (job.contentId) payload.contentId = job.contentId;

      setJob(jobId, (j) => ({
        ...j,
        status: "finalizing",
        updatedAt: Date.now(),
        error: null,
      }));

      try {
        const res = await fetch("/api/creator/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          contentId?: string;
          error?: string;
          requiresPayment?: boolean;
          checkoutUrl?: string;
          reviewStatus?: string;
        };

        if (!res.ok) {
          const message = data.error || "Submission failed";
          setJob(jobId, (j) => ({
            ...j,
            status: "failed",
            error: message,
            finalizeWhenReady: false,
            updatedAt: Date.now(),
          }));
          await notifyUploadEvent({
            type: "CONTENT_UPLOAD_FAILED",
            title: "Catalogue upload failed",
            body: `${job.title}: ${message}`,
            contentId: job.contentId,
            url: job.contentId ? `/creator/upload?contentId=${job.contentId}` : "/creator/upload",
          });
          return { ok: false, error: message };
        }

        const contentId = data.id || data.contentId || job.contentId || undefined;
        setJob(jobId, (j) => ({
          ...j,
          status: "complete",
          contentId: contentId ?? j.contentId,
          finalizeWhenReady: false,
          finalizePayload: null,
          updatedAt: Date.now(),
        }));

        // Server also notifies on submit; draft saves stay quiet in the bell inbox.
        if (payload.reviewStatus && payload.reviewStatus !== "DRAFT") {
          await notifyUploadEvent({
            type: "CONTENT_UPLOAD_COMPLETE",
            title: data.requiresPayment
              ? "Catalogue upload ready — payment needed"
              : "Catalogue upload complete",
            body: data.requiresPayment
              ? `"${job.title}" uploaded. Complete payment to enter the review queue.`
              : `"${job.title}" was submitted for catalogue review.`,
            contentId,
            url: data.requiresPayment && data.checkoutUrl
              ? data.checkoutUrl
              : contentId
                ? `/creator/catalogue/reviews/${contentId}`
                : "/creator/catalogue",
          });
        }

        return {
          ok: true,
          contentId,
          requiresPayment: Boolean(data.requiresPayment),
          checkoutUrl: data.checkoutUrl,
          reviewStatus: data.reviewStatus,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        setJob(jobId, (j) => ({
          ...j,
          status: "failed",
          error: message,
          finalizeWhenReady: false,
          updatedAt: Date.now(),
        }));
        await notifyUploadEvent({
          type: "CONTENT_UPLOAD_FAILED",
          title: "Catalogue upload failed",
          body: `${job.title}: ${message}`,
          contentId: job.contentId,
        });
        return { ok: false, error: message };
      }
    },
    [patchFormUrlsFromJob, setJob],
  );

  const maybeFinalize = useCallback(
    async (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job?.finalizeWhenReady || !job.finalizePayload) return;
      if (job.assets.some((a) => a.status === "queued" || a.status === "uploading")) return;
      if (job.assets.some((a) => a.status === "failed")) {
        setJob(jobId, (j) => ({
          ...j,
          status: "failed",
          error: "One or more files failed to upload",
          finalizeWhenReady: false,
          updatedAt: Date.now(),
        }));
        return;
      }
      await runFinalize(jobId);
    },
    [runFinalize, setJob],
  );

  const pumpQueue = useCallback(() => {
    const current = jobsRef.current;
    const candidates: { jobId: string; asset: CatalogueUploadAsset }[] = [];
    for (const job of current) {
      if (job.status === "cancelled" || job.status === "complete") continue;
      for (const asset of job.assets) {
        if (
          asset.status === "queued" &&
          filesRef.current.has(asset.id) &&
          !inFlightAssetIdsRef.current.has(asset.id)
        ) {
          candidates.push({ jobId: job.id, asset });
        }
      }
    }

    while (activeXhrRef.current < MAX_CONCURRENT_XHR && candidates.length > 0) {
      const next = candidates.shift()!;
      if (inFlightAssetIdsRef.current.has(next.asset.id)) continue;
      const entry = filesRef.current.get(next.asset.id);
      if (!entry) continue;

      inFlightAssetIdsRef.current.add(next.asset.id);
      activeXhrRef.current += 1;
      setJob(next.jobId, (j) => ({
        ...j,
        status: j.status === "finalizing" ? j.status : "uploading",
        updatedAt: Date.now(),
        assets: j.assets.map((a) =>
          a.id === next.asset.id ? { ...a, status: "uploading", progress: Math.max(a.progress, 1) } : a,
        ),
      }));

      const startedAssetId = next.asset.id;
      const startedJobId = next.jobId;

      void (async () => {
        try {
          const payload = await uploadContentMediaViaApiFull(entry.file, {
            signal: entry.abort.signal,
            onProgress: (pct) => {
              // Ignore stale progress if this asset was replaced/removed mid-upload.
              if (!inFlightAssetIdsRef.current.has(startedAssetId)) return;
              setJob(startedJobId, (j) => ({
                ...j,
                assets: j.assets.map((a) =>
                  a.id === startedAssetId
                    ? { ...a, progress: Math.max(a.progress, Math.min(100, pct)) }
                    : a,
                ),
                updatedAt: Date.now(),
              }));
            },
          });
          if (!inFlightAssetIdsRef.current.has(startedAssetId)) return;
          const storageUrl = preferredStorageReference(payload);
          filesRef.current.delete(startedAssetId);
          setJob(startedJobId, (j) => ({
            ...j,
            updatedAt: Date.now(),
            assets: j.assets.map((a) =>
              a.id === startedAssetId
                ? { ...a, status: "complete", progress: 100, storageUrl, error: null }
                : a,
            ),
          }));
          await maybeFinalize(startedJobId);
        } catch (err) {
          filesRef.current.delete(startedAssetId);
          const aborted =
            (err instanceof DOMException && err.name === "AbortError") ||
            (err instanceof Error && err.name === "AbortError");
          // Asset was replaced — state already points at the new slot.
          if (!inFlightAssetIdsRef.current.has(startedAssetId) && aborted) {
            return;
          }
          if (aborted) {
            setJob(startedJobId, (j) => ({
              ...j,
              updatedAt: Date.now(),
              assets: j.assets.map((a) =>
                a.id === startedAssetId
                  ? { ...a, status: "cancelled", error: "Cancelled" }
                  : a,
              ),
            }));
          } else if (inFlightAssetIdsRef.current.has(startedAssetId)) {
            const message = err instanceof Error ? err.message : "Upload failed";
            setJob(startedJobId, (j) => {
              const assets = j.assets.map((a) =>
                a.id === startedAssetId
                  ? { ...a, status: "failed" as const, error: message }
                  : a,
              );
              const draft: CatalogueUploadJob = {
                ...j,
                assets,
                error: message,
                finalizeWhenReady: false,
                updatedAt: Date.now(),
                status: j.status,
              };
              draft.status = deriveCatalogueJobStatus(draft);
              return draft;
            });
            const job = jobsRef.current.find((j) => j.id === startedJobId);
            await notifyUploadEvent({
              type: "CONTENT_UPLOAD_FAILED",
              title: "Catalogue file upload failed",
              body: `${job?.title ?? "Upload"}: ${next.asset.label} — ${message}`,
              contentId: job?.contentId,
              url: job?.contentId
                ? `/creator/upload?contentId=${job.contentId}`
                : "/creator/upload",
            });
          }
        } finally {
          inFlightAssetIdsRef.current.delete(startedAssetId);
          activeXhrRef.current = Math.max(0, activeXhrRef.current - 1);
          pumpRef.current();
        }
      })();
    }

    for (const job of jobsRef.current) {
      if (job.status === "queued" && job.assets.some((a) => a.status === "uploading")) {
        setJob(job.id, (j) => ({ ...j, status: "uploading", updatedAt: Date.now() }));
      }
    }
  }, [maybeFinalize, setJob]);

  useEffect(() => {
    pumpRef.current = pumpQueue;
  }, [pumpQueue]);

  useEffect(() => {
    pumpQueue();
  }, [jobs, pumpQueue]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (jobsRef.current.some(isJobInFlight)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const enqueueAsset = useCallback(
    (input: EnqueueAssetInput): string => {
      ensureJob({ jobId: input.jobId });
      const assetId = input.assetId || newId("asset");

      // Cancel / replace previous asset for the same slot
      const job = jobsRef.current.find((j) => j.id === input.jobId);
      if (job) {
        const prev = job.assets.find((a) => assetMatchesMeta(a, input.kind, input.meta));
        if (prev) {
          if (prev.status === "queued" || prev.status === "uploading") {
            filesRef.current.get(prev.id)?.abort.abort();
            filesRef.current.delete(prev.id);
            // Drop from in-flight so stale XHR callbacks ignore this id;
            // activeXhr count is still decremented in that upload's finally.
            inFlightAssetIdsRef.current.delete(prev.id);
          }
          if (prev.status === "complete") {
            deleteStorageBestEffort(prev.storageUrl);
          }
        }
      }

      const abort = new AbortController();
      filesRef.current.set(assetId, { file: input.file, abort });

      const asset: CatalogueUploadAsset = {
        id: assetId,
        kind: input.kind,
        label: input.label,
        fileName: input.file.name,
        status: "queued",
        progress: 0,
        storageUrl: null,
        error: null,
        meta: input.meta,
      };

      setJob(input.jobId, (j) => {
        const filtered = j.assets.filter((a) => !assetMatchesMeta(a, input.kind, input.meta));
        const assets = [...filtered, asset];
        const draft: CatalogueUploadJob = {
          ...j,
          error: null,
          assets,
          updatedAt: Date.now(),
          status: j.status === "complete" || j.status === "failed" || j.status === "cancelled"
            ? "queued"
            : j.status,
        };
        draft.status = deriveCatalogueJobStatus(draft);
        return draft;
      });

      queueMicrotask(() => pumpRef.current());
      return assetId;
    },
    [ensureJob, setJob],
  );

  const getAsset = useCallback((jobId: string, assetId: string) => {
    return jobsRef.current.find((j) => j.id === jobId)?.assets.find((a) => a.id === assetId);
  }, []);

  const getAssetByKind = useCallback(
    (jobId: string, kind: CatalogueAssetKind, meta?: CatalogueUploadAsset["meta"]) => {
      return jobsRef.current
        .find((j) => j.id === jobId)
        ?.assets.find((a) => assetMatchesMeta(a, kind, meta));
    },
    [],
  );

  const requestFinalize = useCallback(
    async (jobId: string, payload: Record<string, unknown>): Promise<FinalizeResult> => {
      ensureJob({ jobId });
      setJob(jobId, (j) => ({
        ...j,
        finalizePayload: payload,
        finalizeWhenReady: true,
        title:
          typeof payload.title === "string" && payload.title.trim()
            ? payload.title.trim()
            : j.title,
        contentId:
          typeof payload.contentId === "string" ? payload.contentId : j.contentId,
        updatedAt: Date.now(),
      }));

      const job = jobsRef.current.find((j) => j.id === jobId);
      const stillUploading = job?.assets.some(
        (a) => a.status === "queued" || a.status === "uploading",
      );
      if (stillUploading) {
        setJob(jobId, (j) => ({ ...j, status: "uploading", updatedAt: Date.now() }));
        return { ok: true, deferred: true };
      }
      return runFinalize(jobId);
    },
    [ensureJob, runFinalize, setJob],
  );

  const activeJobs = useMemo(
    () => dedupeCatalogueJobs(jobs.filter(isJobVisibleInBell)),
    [jobs],
  );

  const value = useMemo<CatalogueUploadContextValue>(
    () => ({
      jobs,
      activeJobs,
      ensureJob,
      findJob,
      updateJobMeta,
      enqueueAsset,
      removeAsset,
      getAsset,
      getAssetByKind,
      cancelJob,
      dismissJob,
      requestFinalize,
      patchFormUrlsFromJob,
    }),
    [
      jobs,
      activeJobs,
      ensureJob,
      findJob,
      updateJobMeta,
      enqueueAsset,
      removeAsset,
      getAsset,
      getAssetByKind,
      cancelJob,
      dismissJob,
      requestFinalize,
      patchFormUrlsFromJob,
    ],
  );

  return (
    <CatalogueUploadContext.Provider value={value}>{children}</CatalogueUploadContext.Provider>
  );
}

export function useCatalogueUpload(): CatalogueUploadContextValue {
  const ctx = useContext(CatalogueUploadContext);
  if (!ctx) {
    throw new Error("useCatalogueUpload must be used within CatalogueUploadProvider");
  }
  return ctx;
}

/** Safe for NotificationBell (may render outside creator layout). */
export function useCatalogueUploadOptional(): CatalogueUploadContextValue | null {
  return useContext(CatalogueUploadContext);
}

export function useJobAssetProgress(
  jobId: string | null,
  kind: CatalogueAssetKind,
  meta?: CatalogueUploadAsset["meta"],
): { uploading: boolean; progress: number | null; done: boolean; error: string | null; url: string | null } {
  const ctx = useCatalogueUploadOptional();
  const job = jobId ? ctx?.jobs.find((j) => j.id === jobId) : undefined;
  const asset = job?.assets.find((a) => assetMatchesMeta(a, kind, meta));
  return {
    uploading: asset?.status === "queued" || asset?.status === "uploading",
    progress: asset ? asset.progress : null,
    done: asset?.status === "complete",
    error: asset?.error ?? null,
    url: asset?.storageUrl ?? null,
  };
}

// Re-export for consumers that only need progress math
export { jobOverallProgress };
