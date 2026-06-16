/** Build Cloudflare Stream `meta` labels for dashboard search and ingest traceability. */
export function buildStreamIngestMeta(input: {
  name?: string | null;
  fileName?: string | null;
  creatorId?: string | null;
  contentId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  area?: string | null;
  mime?: string | null;
  source?: string | null;
  episodeTitle?: string | null;
  contentTitle?: string | null;
}): Record<string, string> {
  const displayName =
    input.name?.trim() ||
    input.episodeTitle?.trim() ||
    input.contentTitle?.trim() ||
    input.fileName?.trim() ||
    "Storytime upload";

  const meta: Record<string, string> = {
    name: displayName.slice(0, 200),
    source: input.source?.trim() || "storytime",
  };

  if (input.mime?.trim()) meta.mime = input.mime.trim();
  if (input.fileName?.trim()) meta.fileName = input.fileName.trim().slice(0, 200);
  if (input.creatorId?.trim()) meta.creatorId = input.creatorId.trim();
  if (input.contentId?.trim()) meta.contentId = input.contentId.trim();
  if (input.contentTitle?.trim()) meta.contentTitle = input.contentTitle.trim().slice(0, 200);
  if (input.entityType?.trim()) meta.entityType = input.entityType.trim();
  if (input.entityId?.trim()) meta.entityId = input.entityId.trim();
  if (input.area?.trim()) meta.area = input.area.trim();
  if (input.episodeTitle?.trim()) meta.episodeTitle = input.episodeTitle.trim().slice(0, 200);

  return meta;
}
