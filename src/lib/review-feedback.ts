
export type ReviewFeedbackKind = "CATALOGUE" | "SCRIPT" | "METADATA" | "LEGAL" | "OTHER";

export type ReviewFeedbackItem = {
  kind: ReviewFeedbackKind;
  message: string;
  ctaLabel?: string;
  ctaPath?: string;
};

const KINDS: ReviewFeedbackKind[] = ["CATALOGUE", "SCRIPT", "METADATA", "LEGAL", "OTHER"];

function isReviewFeedbackKind(k: string): k is ReviewFeedbackKind {
  return (KINDS as string[]).includes(k);
}

/**
 * App-internal paths only; no protocol, no query with external redirects.
 * If linkedProjectId is set, any /creator/projects/:id/... must use that id.
 */
export function isAllowedReviewCtaPath(path: string, linkedProjectId: string | null): boolean {
  const p = path.trim();
  if (!p.startsWith("/creator/")) return false;
  if (p.includes("..") || p.includes("//")) return false;
  const projectPrefix = "/creator/projects/";
  if (p.startsWith(projectPrefix)) {
    const rest = p.slice(projectPrefix.length);
    const seg = rest.split("/")[0];
    if (!seg || !linkedProjectId || seg !== linkedProjectId) return false;
  }
  return true;
}

export function sanitizeReviewFeedback(
  raw: unknown,
  linkedProjectId: string | null,
): ReviewFeedbackItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const out: ReviewFeedbackItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const kind = typeof o.kind === "string" && isReviewFeedbackKind(o.kind) ? o.kind : "OTHER";
    const message = typeof o.message === "string" ? o.message.trim().slice(0, 4000) : "";
    if (!message) continue;
    const ctaLabel =
      typeof o.ctaLabel === "string" ? o.ctaLabel.trim().slice(0, 120) : undefined;
    let ctaPath: string | undefined;
    if (typeof o.ctaPath === "string" && o.ctaPath.trim()) {
      const candidate = o.ctaPath.trim();
      if (isAllowedReviewCtaPath(candidate, linkedProjectId)) {
        ctaPath = candidate;
      }
    }
    out.push({
      kind,
      message,
      ...(ctaLabel ? { ctaLabel } : {}),
      ...(ctaPath ? { ctaPath } : {}),
    });
  }

  return out.length > 0 ? out : null;
}

export function parseReviewFeedback(json: unknown): ReviewFeedbackItem[] {
  if (!json || !Array.isArray(json)) return [];
  return json.filter(
    (x): x is ReviewFeedbackItem =>
      !!x &&
      typeof x === "object" &&
      typeof (x as ReviewFeedbackItem).message === "string",
  ) as ReviewFeedbackItem[];
}

/** Presets for admin UI; {projectId} replaced with linked project id when present */
export const REVIEW_CTA_PRESET_TEMPLATES: { label: string; path: string }[] = [
  { label: "Catalogue upload", path: "/creator/upload" },
  { label: "My Projects", path: "/creator/dashboard" },
  { label: "Post-production hub", path: "/creator/post-production" },
  { label: "Music hub", path: "/creator/music" },
  { label: "Script writing", path: "/creator/projects/{projectId}/pre-production/script-writing" },
  { label: "Script review", path: "/creator/projects/{projectId}/pre-production/script-review" },
  { label: "Distribution (workspace)", path: "/creator/projects/{projectId}/post-production/distribution" },
  { label: "Final cut approval", path: "/creator/projects/{projectId}/post-production/final-cut-approval" },
  { label: "Film packaging", path: "/creator/projects/{projectId}/post-production/film-packaging" },
];

export function resolveCtaPresetPath(template: string, linkedProjectId: string | null): string | null {
  if (!template.includes("{projectId}")) return template;
  if (!linkedProjectId) return null;
  return template.replace(/\{projectId\}/g, linkedProjectId);
}
