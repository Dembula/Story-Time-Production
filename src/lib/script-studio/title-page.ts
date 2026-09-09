/** Shared screenplay title-page helpers (US Letter cover sheet). */

export const SCRIPT_TYPE_LABELS: Record<string, string> = {
  FEATURE: "Feature Film",
  SHORT: "Short Film",
  EPISODE: "Episode",
  OTHER: "Screenplay",
};

export function scriptTypeLabel(type: string | null | undefined): string {
  const key = (type || "FEATURE").toUpperCase();
  return SCRIPT_TYPE_LABELS[key] ?? "Screenplay";
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
