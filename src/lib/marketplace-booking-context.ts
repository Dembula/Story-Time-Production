import { embedMeta, parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";

export type MarketplaceBookingContextMeta = {
  projectId?: string | null;
  projectTitle?: string | null;
};

export function buildMarketplaceBookingNote(
  plainNote: string | null | undefined,
  ctx: MarketplaceBookingContextMeta,
): string | null {
  const meta: MarketplaceBookingContextMeta = {};
  if (ctx.projectId) meta.projectId = ctx.projectId;
  if (ctx.projectTitle) meta.projectTitle = ctx.projectTitle;
  const hasMeta = Boolean(meta.projectId || meta.projectTitle);
  return embedMeta(plainNote, hasMeta ? meta : null);
}

export function parseMarketplaceBookingNote(note: string | null | undefined) {
  const { plain, meta } = parseEmbeddedMeta<MarketplaceBookingContextMeta>(note);
  return {
    plainNote: plain,
    projectId: meta?.projectId ?? null,
    projectTitle: meta?.projectTitle ?? null,
  };
}
