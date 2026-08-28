export type EditReviewStatus = "IN_REVIEW" | "NEEDS_CHANGES" | "APPROVED";

export type EditFootageAsset = {
  id: string;
  label: string | null;
  fileUrl: string;
  type: string;
  createdAt: string;
  metadata: string | null;
};

export type EditReviewNote = {
  id: string;
  reviewId: string;
  userId: string | null;
  body: string;
  timestampMs: number | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
};

export type EditReviewSession = {
  id: string;
  projectId: string;
  title: string | null;
  cutAssetId: string | null;
  status: EditReviewStatus;
  createdAt: string;
  updatedAt: string;
  cutAsset?: EditFootageAsset | null;
  notes: EditReviewNote[];
};

export function formatReviewTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const frames = Math.floor((ms % 1000) / (1000 / 24));
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  if (hr > 0) {
    return `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export function parseReviewStatus(raw: string | null | undefined): EditReviewStatus {
  if (raw === "APPROVED" || raw === "NEEDS_CHANGES") return raw;
  return "IN_REVIEW";
}
