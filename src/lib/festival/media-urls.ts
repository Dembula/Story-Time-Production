import { packBrowserMediaUrl } from "@/lib/pack-storage-media-url";
import { resolveNativeVideoSafeUrl } from "@/lib/playback-sources";

/** Persist / return browser-reachable image URLs (never leave bare `s3://` for <img>). */
export function packFestivalImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return packBrowserMediaUrl(trimmed);
}

/** Persist / return a playable HTTPS video URL for festival screeners. */
export function packFestivalVideoUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const packed = /^https?:\/\//i.test(trimmed) ? trimmed : packBrowserMediaUrl(trimmed);
  if (!packed) return null;
  return resolveNativeVideoSafeUrl(packed) ?? packed;
}

export function packFestivalMediaAssetUrl(url: string): string {
  return packFestivalImageUrl(url) ?? url;
}
