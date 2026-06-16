"use client";

import type { PlaybackManifest } from "./manifest-types";

/**
 * Warm everything required to start playback in <300ms after the play button
 * is pressed (Netflix-class start time):
 *
 *   1. Resolve DNS + open TLS to the manifest origin (preconnect).
 *   2. Pre-fetch the manifest itself (HLS/DASH).
 *   3. Pre-fetch the application certificate for FairPlay so the very first
 *      `webkitneedkey` doesn't have to wait on an HTTP round-trip.
 *   4. Warm the first media segment (low-priority fetch) so the player can
 *      paint a frame on play() without buffering.
 *
 * Each operation is debounced/de-duplicated globally so calling this from
 * hover handlers + click handlers + detail-page mount is safe.
 */

const warmedManifests = new Set<string>();
const warmedCertificates = new Set<string>();
const warmedSegments = new Set<string>();
const warmedOrigins = new Set<string>();

function preconnect(url: string): void {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  if (warmedOrigins.has(origin)) return;
  warmedOrigins.add(origin);
  for (const rel of ["preconnect", "dns-prefetch"] as const) {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = origin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

async function lowPriorityFetch(url: string, init?: RequestInit): Promise<void> {
  try {
    await fetch(url, {
      ...init,
      mode: "cors",
      credentials: init?.credentials ?? "omit",
      priority: "low",
    } as RequestInit & { priority?: "high" | "low" | "auto" });
  } catch {
    // Best-effort.
  }
}

export function prewarmManifestUrl(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  preconnect(url);
  if (warmedManifests.has(url)) return;
  warmedManifests.add(url);

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "fetch";
  link.href = url;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  void lowPriorityFetch(url, { credentials: "include" });
}

export function prewarmCertificate(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  preconnect(url);
  if (warmedCertificates.has(url)) return;
  warmedCertificates.add(url);
  void lowPriorityFetch(url, { credentials: "include" });
}

export function prewarmFirstSegment(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  preconnect(url);
  if (warmedSegments.has(url)) return;
  warmedSegments.add(url);
  void lowPriorityFetch(url, { credentials: "omit" });
}

/**
 * Prewarm everything a manifest needs (manifest, DRM cert, first segment).
 * Safe to call from hover, detail-page mount, or right before navigation.
 */
export function prewarmFromManifest(manifest: PlaybackManifest | null | undefined): void {
  if (!manifest || typeof window === "undefined") return;
  const primary = manifest.sources[0];
  if (!primary) return;

  prewarmManifestUrl(primary.src);
  for (const origin of primary.warmupOrigins ?? []) {
    preconnect(origin);
  }
  if (primary.drm?.certificateUrl) {
    prewarmCertificate(primary.drm.certificateUrl);
  }
  if (manifest.instantStart.warmFirstSegment) {
    prewarmFirstSegment(manifest.instantStart.firstSegmentUrl ?? null);
  }
}
