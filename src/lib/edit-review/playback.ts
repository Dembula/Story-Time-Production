import { isPlatformStorageReference } from "@/lib/secure-file-access";
import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";
import type { EditFootageAsset } from "./types";

export type ResolvedEditPlayback = {
  src: string;
  kind: "hls" | "mp4" | "preview";
};

/** Sync resolve — HLS/Stream URLs or same-origin preview path (fallback). */
export function resolveEditPlaybackUrl(
  asset: Pick<EditFootageAsset, "fileUrl" | "metadata"> | null | undefined,
  projectId: string,
): string | null {
  const resolved = resolveEditPlayback(asset, projectId);
  return resolved?.src ?? null;
}

export function resolveEditPlayback(
  asset: Pick<EditFootageAsset, "fileUrl" | "metadata"> | null | undefined,
  projectId: string,
): ResolvedEditPlayback | null {
  if (!asset?.fileUrl?.trim()) return null;

  if (asset.metadata) {
    try {
      const meta = JSON.parse(asset.metadata) as {
        hlsUrl?: string;
        playbackUrl?: string;
        proxyUrl?: string;
      };
      const hls = meta.hlsUrl?.trim();
      if (hls) return { src: hls, kind: "hls" };
      const mp4 = meta.playbackUrl?.trim() || meta.proxyUrl?.trim();
      if (mp4) {
        const isHls = /\.m3u8(\?|$)/i.test(mp4);
        return { src: mp4, kind: isHls ? "hls" : "mp4" };
      }
    } catch {
      // ignore malformed metadata
    }
  }

  const preview = resolveRenderableFileSource(asset.fileUrl, { projectId });
  if (!preview) return null;
  return {
    src: preview,
    kind: isPlatformStorageReference(asset.fileUrl) ? "preview" : "mp4",
  };
}

/** Prefer a direct signed S3 URL for private storage videos (Range/seek friendly). */
export async function resolveEditPlaybackSrc(
  asset: Pick<EditFootageAsset, "fileUrl" | "metadata"> | null | undefined,
  projectId: string,
): Promise<ResolvedEditPlayback | null> {
  const base = resolveEditPlayback(asset, projectId);
  if (!base) return null;
  if (base.kind === "hls" || base.kind === "mp4") return base;
  if (!asset?.fileUrl || !isPlatformStorageReference(asset.fileUrl)) return base;

  try {
    const params = new URLSearchParams({
      ref: asset.fileUrl,
      context: "project",
      projectId,
    });
    const res = await fetch(`/api/files/signed-url?${params.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return base;
    const json = (await res.json()) as { url?: string };
    if (json.url?.trim()) {
      return { src: json.url.trim(), kind: "mp4" };
    }
  } catch {
    // fall back to proxy preview
  }
  return base;
}
