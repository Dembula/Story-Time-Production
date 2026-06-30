import type { ReviewStamp } from "./types";

export const REVIEW_STAMPS: Array<{
  id: ReviewStamp;
  label: string;
  color: string;
  bg: string;
}> = [
  { id: "approved", label: "Approved", color: "#166534", bg: "#bbf7d0" },
  { id: "rejected", label: "Rejected", color: "#991b1b", bg: "#fecaca" },
  { id: "needs_revision", label: "Needs revision", color: "#92400e", bg: "#fde68a" },
  { id: "approved_with_notes", label: "Approved w/ notes", color: "#1e40af", bg: "#bfdbfe" },
  { id: "date", label: "Date stamp", color: "#374151", bg: "#e5e7eb" },
];

export function stampMeta(id: ReviewStamp) {
  return REVIEW_STAMPS.find((s) => s.id === id) ?? REVIEW_STAMPS[0];
}

export function stampLabel(id: ReviewStamp, date?: string): string {
  if (id === "date") return date ?? new Date().toLocaleDateString();
  return stampMeta(id).label;
}
