import { randomBytes } from "crypto";

export const STUDIO_SUITE_OPTIONS = [
  { id: "pipeline_pre", label: "Pre-production workspace" },
  { id: "pipeline_prod", label: "Production workspace" },
  { id: "pipeline_post", label: "Post-production workspace" },
  { id: "catalogue_upload", label: "Catalogue upload & originals" },
  { id: "analytics", label: "Analytics & revenue" },
] as const;

export type StudioSuiteId = (typeof STUDIO_SUITE_OPTIONS)[number]["id"];

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function inviteExpiresAtDefault(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d;
}

export function isValidSuiteList(suites: unknown): suites is string[] {
  if (!Array.isArray(suites)) return false;
  const allowed = new Set(STUDIO_SUITE_OPTIONS.map((s) => s.id));
  return suites.every((x) => typeof x === "string" && allowed.has(x as StudioSuiteId));
}
