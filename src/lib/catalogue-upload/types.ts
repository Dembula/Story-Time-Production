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
export const MAX_CONCURRENT_XHR = 2;

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

export function isJobInFlight(job: CatalogueUploadJob): boolean {
  return (
    job.status === "queued" ||
    job.status === "uploading" ||
    job.status === "finalizing" ||
    job.assets.some((a) => a.status === "queued" || a.status === "uploading")
  );
}
