export type InternalReviewEntryV2 = {
  id: string;
  scriptVersionId: string;
  scriptLabel: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ScriptReviewNoteBodyV2 = {
  draftByScript?: Record<string, string>;
  internalReviews?: InternalReviewEntryV2[];
};

export function parseScriptReviewNoteBodyV2(raw: unknown): ScriptReviewNoteBodyV2 {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as ScriptReviewNoteBodyV2;
    return {
      draftByScript: parsed?.draftByScript ?? {},
      internalReviews: Array.isArray(parsed?.internalReviews) ? parsed.internalReviews : [],
    };
  } catch {
    return {};
  }
}
