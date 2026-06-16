import { parsePlatformScriptVersionId } from "@/lib/content-catalogue-tags";

/** Lightweight check — keep this module free of pdf/mammoth/enrichment imports. */
export function contentHasScriptSource(input: {
  scriptUrl?: string | null;
  tags?: string | null;
  linkedProjectId?: string | null;
}): boolean {
  return Boolean(
    input.scriptUrl?.trim() ||
      input.linkedProjectId?.trim() ||
      parsePlatformScriptVersionId(input.tags),
  );
}
