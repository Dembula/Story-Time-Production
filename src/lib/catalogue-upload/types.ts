export type CatalogueAssetKind =
  | "mainVideo"
  | "trailer"
  | "poster"
  | "backdrop"
  | "script"
  | "bts"
  | "episode";

export type CatalogueAssetStatus = "queued" | "uploading" | "complete" | "failed" | "cancelled";

export type CatalogueJobStatus =
  | "queued"
  | "uploading"
  | "finalizing"
  | "complete"
  | "failed"
  | "cancelled";

export type CatalogueUploadAsset = {
  id: string;
  kind: CatalogueAssetKind;
  label: string;
  fileName: string;
  status: CatalogueAssetStatus;
  progress: number;
  /** Set when S3 upload finishes */
  storageUrl: string | null;
  error: string | null;
  /** Episode / BTS slot identity */
  meta?: {
    seasonNumber?: number;
    episodeNumber?: number;
    btsIndex?: number;
  };
};

export type CatalogueUploadJob = {
  id: string;
  title: string;
  contentId: string | null;
  linkedProjectId: string | null;
  status: CatalogueJobStatus;
  assets: CatalogueUploadAsset[];
  error: string | null;
  createdAt: number;
  updatedAt: number;
  /** When true, POST content payload after all assets succeed */
  finalizeWhenReady: boolean;
  /** Opaque content POST body (without waiting URLs patched in) */
  finalizePayload: Record<string, unknown> | null;
};

export const MAX_CONCURRENT_JOBS = 3;
/** Parallel catalogue asset uploads (poster + video can overlap; video uses internal multipart concurrency). */
export const MAX_CONCURRENT_XHR = 3;

export const EDITABLE_CATALOGUE_STATUSES = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "REJECTED",
  "CHANGES_REQUESTED",
  "UNPUBLISHED",
] as const;

export type EditableCatalogueStatus = (typeof EDITABLE_CATALOGUE_STATUSES)[number];

export function isEditableCatalogueStatus(status: string): boolean {
  return (EDITABLE_CATALOGUE_STATUSES as readonly string[]).includes(status);
}

/** Creators may remove mistaken uploads that are not live in the approved catalogue. */
export const DELETABLE_CATALOGUE_STATUSES = [
  ...EDITABLE_CATALOGUE_STATUSES,
  "PENDING",
] as const;

export function isDeletableCatalogueStatus(status: string): boolean {
  return (DELETABLE_CATALOGUE_STATUSES as readonly string[]).includes(status);
}

export function jobOverallProgress(job: CatalogueUploadJob): number {
  if (job.assets.length === 0) {
    if (job.status === "finalizing") return 95;
    if (job.status === "complete") return 100;
    return 0;
  }
  const sum = job.assets.reduce((acc, a) => {
    if (a.status === "complete") return acc + 100;
    if (a.status === "failed" || a.status === "cancelled") return acc + 0;
    return acc + Math.min(100, Math.max(0, a.progress));
  }, 0);
  const assetPct = sum / job.assets.length;
  if (job.status === "finalizing") return Math.min(99, assetPct * 0.95 + 5);
  if (job.status === "complete") return 100;
  return Math.round(assetPct);
}

export function jobActiveAssetLabel(job: CatalogueUploadJob): string | null {
  const uploading = job.assets.find((a) => a.status === "uploading");
  if (uploading) return uploading.label;
  const queued = job.assets.find((a) => a.status === "queued");
  if (queued) return queued.label;
  if (job.status === "finalizing") return "Saving catalogue entry…";
  return null;
}

/** Human-readable name for each media slot (bell + dropzone). */
export function catalogueAssetKindLabel(
  kind: CatalogueAssetKind,
  meta?: CatalogueUploadAsset["meta"],
): string {
  switch (kind) {
    case "mainVideo":
      return "Main film / master video";
    case "trailer":
      return "Trailer";
    case "poster":
      return "Poster image";
    case "backdrop":
      return "Backdrop / banner image";
    case "script":
      return "Script (PDF)";
    case "bts":
      return meta?.btsIndex != null
        ? `Behind-the-scenes clip #${meta.btsIndex + 1}`
        : "Behind-the-scenes clip";
    case "episode":
      if (meta?.seasonNumber != null && meta?.episodeNumber != null) {
        return `Episode video · S${meta.seasonNumber} E${meta.episodeNumber}`;
      }
      return "Episode video";
    default:
      return "Media file";
  }
}

export function catalogueAssetStatusLabel(status: CatalogueAssetStatus): string {
  switch (status) {
    case "queued":
      return "Waiting";
    case "uploading":
      return "Uploading";
    case "complete":
      return "Done";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** True only when real media is transferring or the job is saving after uploads. */
export function isJobInFlight(job: CatalogueUploadJob): boolean {
  if (job.status === "finalizing") return true;
  return job.assets.some((a) => a.status === "queued" || a.status === "uploading");
}

export function normalizeCatalogueJobTitle(title: string | null | undefined): string {
  return (title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match an existing catalogue upload job for the same title/content (avoids duplicates). */
export function jobsMatchCatalogueIdentity(
  job: CatalogueUploadJob,
  identity: { contentId?: string | null; title?: string | null },
): boolean {
  const contentId = identity.contentId?.trim() || null;
  if (contentId && job.contentId === contentId) return true;
  const title = normalizeCatalogueJobTitle(identity.title);
  if (title && normalizeCatalogueJobTitle(job.title) === title) return true;
  return false;
}

/** Prefer one job per contentId / title so the bell never lists duplicates. */
export function dedupeCatalogueJobs(jobs: CatalogueUploadJob[]): CatalogueUploadJob[] {
  const byKey = new Map<string, CatalogueUploadJob>();
  for (const job of jobs) {
    const key = job.contentId
      ? `id:${job.contentId}`
      : `title:${normalizeCatalogueJobTitle(job.title) || job.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, job);
      continue;
    }
    // Keep the job with more recent activity / more assets
    const existingScore = existing.updatedAt + existing.assets.length * 1000;
    const nextScore = job.updatedAt + job.assets.length * 1000;
    if (nextScore >= existingScore) byKey.set(key, job);
  }
  return Array.from(byKey.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Jobs that should appear in the notification bell (never empty placeholders). */
export function isJobVisibleInBell(job: CatalogueUploadJob): boolean {
  if (job.assets.length === 0 && job.status !== "finalizing") {
    return false;
  }
  if (isJobInFlight(job)) return true;
  if (job.status === "failed" || job.assets.some((a) => a.status === "failed")) return true;
  if (job.status === "complete" && Date.now() - job.updatedAt < 60_000) return true;
  return false;
}

export function deriveCatalogueJobStatus(job: CatalogueUploadJob): CatalogueJobStatus {
  if (job.status === "finalizing") return "finalizing";
  if (job.status === "cancelled" && !job.assets.some((a) => a.status === "queued" || a.status === "uploading")) {
    return "cancelled";
  }
  if (job.assets.some((a) => a.status === "queued" || a.status === "uploading")) return "uploading";
  if (job.finalizeWhenReady && job.finalizePayload) return "finalizing";
  if (job.assets.some((a) => a.status === "failed")) return "failed";
  if (job.assets.length > 0 && job.assets.every((a) => a.status === "complete")) {
    return "complete";
  }
  return job.status === "queued" ? "queued" : job.status;
}
