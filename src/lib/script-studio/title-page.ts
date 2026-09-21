/** Shared screenplay title-page helpers (US Letter cover sheet). */

export const SCRIPT_TYPE_LABELS: Record<string, string> = {
  FEATURE: "Feature Film",
  SHORT: "Short Film",
  EPISODE: "TV / Series Episode",
  OTHER: "Screenplay",
};

export type ScriptTitlePageKind = "feature" | "episode" | "other";

export function scriptTypeLabel(type: string | null | undefined): string {
  const key = (type || "FEATURE").toUpperCase();
  return SCRIPT_TYPE_LABELS[key] ?? "Screenplay";
}

/** Feature/short share theatrical layout; episode uses series + episode title. */
export function scriptTitlePageKind(type: string | null | undefined): ScriptTitlePageKind {
  const key = (type || "FEATURE").toUpperCase();
  if (key === "EPISODE" || key === "SERIES" || key === "PILOT" || key === "TV") {
    return "episode";
  }
  if (key === "FEATURE" || key === "SHORT") return "feature";
  return "other";
}

export function resolveScriptAuthorName(input: {
  professionalName?: string | null;
  name?: string | null;
  email?: string | null;
}): string {
  return (
    input.professionalName?.trim() ||
    input.name?.trim() ||
    input.email?.split("@")[0]?.trim() ||
    "Creator"
  );
}

/**
 * Display value for the title-page writer field.
 * `null` = not customized yet → show account/profile default.
 * Any string (including "") = explicit per-script credit while editing/saving.
 */
export function resolveTitlePageWriterCredit(
  writerCredit: string | null | undefined,
  profileDefault: string,
): string {
  if (writerCredit === null || writerCredit === undefined) return profileDefault;
  return writerCredit;
}

/** Filename stem → readable title when draft title is empty/untitled. */
export function titleFromImportFilename(filename: string): string {
  return filename
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldReplaceDraftTitle(currentTitle: string | null | undefined): boolean {
  const t = (currentTitle || "").trim();
  return !t || /^untitled/i.test(t) || /^new script/i.test(t);
}

export function defaultEpisodeTitle(existing?: string | null): string {
  const t = (existing || "").trim();
  return t || "Pilot";
}
