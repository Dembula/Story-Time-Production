import { prisma } from "@/lib/prisma";
import { validateStorageUrlField } from "@/lib/storage-origin";

export type SubtitleUpsertInput = {
  language: string;
  label: string;
  vttUrl: string;
  isDefault?: boolean;
};

/** Replace subtitle tracks for a catalogue title (optional upload flow). */
export async function syncContentSubtitles(
  contentId: string,
  subtitles: SubtitleUpsertInput[],
): Promise<void> {
  const valid: SubtitleUpsertInput[] = [];
  const seenLanguages = new Set<string>();

  for (const row of subtitles) {
    const language = String(row.language ?? "").trim();
    const label = String(row.label ?? language).trim();
    const vttUrl = String(row.vttUrl ?? "").trim();
    if (!language || !label || !vttUrl) continue;
    if (seenLanguages.has(language)) continue;

    const urlErr = validateStorageUrlField(vttUrl, "subtitles.vttUrl", { allowNull: false });
    if (urlErr) continue;

    seenLanguages.add(language);
    valid.push({
      language,
      label,
      vttUrl,
      isDefault: Boolean(row.isDefault),
    });
  }

  if (valid.length === 0) {
    await prisma.contentSubtitle.deleteMany({ where: { contentId } });
    return;
  }

  const defaultIndex = valid.findIndex((row) => row.isDefault);
  const normalized = valid.map((row, index) => ({
    ...row,
    isDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0,
  }));

  await prisma.$transaction([
    prisma.contentSubtitle.deleteMany({ where: { contentId } }),
    ...normalized.map((row) =>
      prisma.contentSubtitle.create({
        data: {
          contentId,
          language: row.language,
          label: row.label,
          vttUrl: row.vttUrl,
          isDefault: row.isDefault,
        },
      }),
    ),
  ]);
}
