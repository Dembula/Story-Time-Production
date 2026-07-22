/**
 * Cloudflare Stream rejects inputs whose average bitrate exceeds ~200 Mbps
 * (typical for ProRes / uncompressed / camera masters). Stay under that with margin.
 * @see https://developers.cloudflare.com/stream/faq/
 */
export const CLOUDFLARE_STREAM_MAX_INPUT_BITRATE_MBPS = 200;

/** Refuse direct Stream copy above this; route to mezzanine or ask for a delivery master. */
export const STREAM_SAFE_INPUT_BITRATE_MBPS = 180;

/** MediaConvert mezzanine target — high quality, well under Stream's hard limit. */
export const STREAM_MEZZANINE_MAX_BITRATE_BPS = 40_000_000;

export function estimateAverageBitrateMbps(fileSizeBytes: number, durationSeconds: number): number | null {
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0.5) return null;
  return (fileSizeBytes * 8) / durationSeconds / 1_000_000;
}

export function isOverStreamBitrateLimit(bitrateMbps: number | null | undefined): boolean {
  return typeof bitrateMbps === "number" && Number.isFinite(bitrateMbps) && bitrateMbps > STREAM_SAFE_INPUT_BITRATE_MBPS;
}

export function isCloudflareBitrateRejectError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /average bitrate exceeds|bitrate exceeds\s*200\s*mbps|compress your video first|uncompressed video/i.test(
    message,
  );
}

export function streamDeliveryMasterHint(): string {
  return (
    "Delivery master for streaming: MP4 (H.264), AAC audio, 1080p or 4K, average bitrate well under 200 Mbps " +
    "(typical features: 8–40 Mbps). Uncompressed / ProRes / camera RAW masters cannot go straight to Cloudflare Stream — " +
    "export a compressed delivery file first, or enable server mezzanine (MediaConvert)."
  );
}

export function bitrateTooHighUserMessage(bitrateMbps: number): string {
  const rounded = Math.round(bitrateMbps);
  return (
    `This file averages ~${rounded} Mbps. Cloudflare Stream rejects inputs over ${CLOUDFLARE_STREAM_MAX_INPUT_BITRATE_MBPS} Mbps ` +
    `(usually uncompressed or ProRes masters). Export an H.264 MP4 delivery master under ~${STREAM_SAFE_INPUT_BITRATE_MBPS} Mbps ` +
    `(HandBrake: H.264, RF 18–20, or average bitrate 15–40 Mbps), then upload again. ` +
    `Your original can stay in storage; only the delivery master is needed for encoding.`
  );
}

export function mezzanineQueuedUserMessage(): string {
  return "High-bitrate master detected. Compressing to a Stream-safe mezzanine before encoding — this can take a while for large features.";
}
