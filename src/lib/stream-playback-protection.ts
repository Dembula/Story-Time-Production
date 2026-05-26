/** Client-safe flag: player must use signed URLs from playback-bundle (no cleartext manifest). */
export function isStreamSignedPlaybackClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STREAM_SIGNED_URLS === "true";
}

/** Refresh signed tokens before server TTL (default 4h). */
export const SIGNED_PLAYBACK_STALE_MS = 3 * 60 * 60 * 1000;
