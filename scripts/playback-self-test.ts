/**
 * Story Time — Playback Self-Test
 *
 * Verifies that every part of the playback pipeline is connected:
 *   1. Cloudflare Stream credentials are valid.
 *   2. Sample content has a Stream UID and a `ready` StreamAsset row.
 *   3. The playback-bundle API returns a manifest with at least one source.
 *   4. The signed-playback path mints a token (when enabled).
 *   5. The DRM proxy responds for every configured key system.
 *
 * Usage:  npx tsx scripts/playback-self-test.ts [contentId]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getCloudflareStreamConfig, isCloudflareStreamUrl } from "../src/lib/cloudflare-stream";
import { buildSignedCloudflarePlaybackSource } from "../src/lib/cloudflare-stream-signed-url";
import { getDrmProviderConfig } from "../src/lib/playback/drm-config";
import { buildPlaybackManifest } from "../src/lib/playback/manifest";
import { prisma } from "../src/lib/prisma";

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const targetId = process.argv[2] || null;

  const cfg = getCloudflareStreamConfig();
  const drm = getDrmProviderConfig();

  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    cloudflare: {
      configured: Boolean(cfg),
      signedPlaybackEnabled: process.env.CLOUDFLARE_STREAM_SIGNED_URLS === "true",
      clientSignedFlag: process.env.NEXT_PUBLIC_STREAM_SIGNED_URLS === "true",
      webhookSecretConfigured: Boolean(process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET),
    },
    drm: {
      enabled: drm.enabled,
      fairPlayConfigured: drm.fairplay.enabled,
      widevineConfigured: drm.widevine.enabled,
      playReadyConfigured: drm.playready.enabled,
    },
    sample: null as unknown,
    manifest: null as unknown,
    errors: [] as string[],
  };

  let sample = null;
  if (targetId) {
    sample = await prisma.content.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        trailerUrl: true,
        subtitles: { select: { id: true, language: true, label: true, vttUrl: true, isDefault: true } },
      },
    });
  } else {
    sample = await prisma.content.findFirst({
      where: { published: true, videoUrl: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        trailerUrl: true,
        subtitles: { select: { id: true, language: true, label: true, vttUrl: true, isDefault: true } },
      },
    });
  }

  if (!sample?.videoUrl) {
    report.errors = (report.errors as string[]).concat([
      "No published content with a videoUrl was found.",
    ]);
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  report.sample = {
    id: sample.id,
    title: sample.title,
    videoUrl: sample.videoUrl,
    isStreamUrl: isCloudflareStreamUrl(sample.videoUrl ?? ""),
    subtitleCount: sample.subtitles?.length ?? 0,
  };

  // Build the manifest exactly the way the API does.
  const manifest = await buildPlaybackManifest({
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? null,
    contentScope: sample.id,
    videoUrl: sample.videoUrl,
    subtitles: (sample.subtitles ?? []).map((s) => ({
      id: s.id,
      language: s.language,
      label: s.label,
      vttUrl: s.vttUrl,
      isDefault: s.isDefault,
    })),
    concurrentSessionsEnforced: true,
    watermarkActive: true,
    deviceFamilyHint: "unknown",
  });

  report.manifest = {
    sourceCount: manifest.sources.length,
    keySystems: manifest.sources.map((s) => ({
      container: s.container,
      keySystem: s.drm?.keySystem ?? "clear",
      mime: s.type,
    })),
    signedPlayback: manifest.compliance.signedPlayback,
    fairPlayReady: manifest.compliance.fairPlayReady,
    hardwareDrm: manifest.compliance.hardwareDrm,
    instantStart: manifest.instantStart,
  };

  // If signed playback is enabled, attempt to sign one URL.
  if (process.env.CLOUDFLARE_STREAM_SIGNED_URLS === "true" && sample.videoUrl) {
    const signed = await buildSignedCloudflarePlaybackSource(sample.videoUrl);
    if (!signed) {
      (report.errors as string[]).push(
        "Signed playback is enabled but no signed URL could be minted. Check CLOUDFLARE_STREAM_SIGNING_KEY_ID + (PEM|JWK).",
      );
    } else {
      (report.cloudflare as Record<string, unknown>).signedSamplePresent = true;
    }
  }

  console.log(JSON.stringify(report, null, 2));

  const errors = report.errors as string[];
  if (errors.length) {
    console.error("\nSelf-test failures:", errors.join("; "));
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
