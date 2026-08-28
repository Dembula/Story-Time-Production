import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";
import type { EditFootageAsset } from "./types";

/** Resolve a playable URL for an edit / footage asset in the review studio. */
export function resolveEditPlaybackUrl(
  asset: Pick<EditFootageAsset, "fileUrl" | "metadata"> | null | undefined,
  projectId: string,
): string | null {
  if (!asset?.fileUrl?.trim()) return null;

  if (asset.metadata) {
    try {
      const meta = JSON.parse(asset.metadata) as {
        hlsUrl?: string;
        playbackUrl?: string;
        proxyUrl?: string;
      };
      const streamUrl = meta.hlsUrl?.trim() || meta.playbackUrl?.trim() || meta.proxyUrl?.trim();
      if (streamUrl) return streamUrl;
    } catch {
      // ignore malformed metadata
    }
  }

  return resolveRenderableFileSource(asset.fileUrl, { projectId });
}
