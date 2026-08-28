import { packBrowserMediaUrl } from "@/lib/pack-storage-media-url";
import type { PlaybackSubtitleTrack } from "@/lib/subtitles/types";

type SubtitleRow = {
  id: string;
  language: string;
  label: string;
  vttUrl: string;
  isDefault: boolean;
};

/** Package catalogue subtitle rows for the playback bundle + player. */
export function buildPlaybackSubtitleTracks(
  contentId: string,
  rows: SubtitleRow[],
): PlaybackSubtitleTrack[] {
  return rows.map((row) => {
    const packed = packBrowserMediaUrl(row.vttUrl);
    return {
      id: row.id,
      language: row.language,
      label: row.label,
      vttUrl: packed ?? row.vttUrl,
      proxyUrl: `/api/content/${contentId}/subtitles/${row.id}/vtt`,
      isDefault: row.isDefault,
    };
  });
}
