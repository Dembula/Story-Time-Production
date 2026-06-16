import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getCloudflareStreamConfig, extractCloudflareStreamUid } from "../src/lib/cloudflare-stream";
import { getServerCaptureProtectionConfig } from "../src/lib/content-capture-protection";
import { getStreamAssetsByUrls } from "../src/lib/stream-asset-store";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
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
    process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const streamConfig = getCloudflareStreamConfig();
  const captureProtection = getServerCaptureProtectionConfig();
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

  const [contentRows, episodeRows, streamAssetCount] = hasDatabaseUrl
    ? await Promise.all([
        prisma.content.findMany({
          where: { published: true },
          select: { id: true, title: true, videoUrl: true, trailerUrl: true },
          take: 5000,
        }),
        prisma.contentEpisode.findMany({
          where: { season: { content: { published: true } } },
          select: { id: true, title: true, videoUrl: true },
          take: 10000,
        }),
        prisma.streamAsset.count(),
      ])
    : [[], [], 0];

  const playbackUrls = [
    ...contentRows.flatMap((row) => [row.videoUrl, row.trailerUrl]),
    ...episodeRows.map((row) => row.videoUrl),
  ].filter((url): url is string => Boolean(url?.trim()));

  const assetsByUrl = hasDatabaseUrl ? await getStreamAssetsByUrls(playbackUrls) : new Map();
  const unresolvedExamples: Array<{ id: string; title: string; url: string }> = [];
  let unresolvedCount = 0;
  let readyStreamLinkedCount = 0;

  for (const row of contentRows) {
    for (const entry of [row.videoUrl, row.trailerUrl]) {
      const url = entry?.trim();
      if (!url) continue;
      const streamUid = extractCloudflareStreamUid(url);
      const streamAsset = assetsByUrl.get(url);
      const streamReady =
        (streamAsset?.status ? READY_STREAM_STATES.has(streamAsset.status.toLowerCase()) : false) ||
        Boolean(streamUid);
      if (streamReady) {
        readyStreamLinkedCount += 1;
      } else {
        unresolvedCount += 1;
        if (unresolvedExamples.length < 8) {
          unresolvedExamples.push({ id: row.id, title: row.title, url });
        }
      }
    }
  }

  const mandatoryFlags = {
    streamConfigOk: Boolean(streamConfig),
    signedPlaybackServerEnabled: process.env.CLOUDFLARE_STREAM_SIGNED_URLS === "true",
    signedPlaybackClientEnabled: process.env.NEXT_PUBLIC_STREAM_SIGNED_URLS === "true",
    streamWebhookSecretSet: Boolean(process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim()),
    databaseUrlSet: hasDatabaseUrl,
  };

  const drmFlags = {
    mode: captureProtection.mode,
    drmEnabled: captureProtection.enabled && captureProtection.mode === "drm",
    widevineConfigured: Boolean(captureProtection.multiDrm.widevineLicenseUrl ?? captureProtection.drmLicenseUrl),
    playreadyConfigured: Boolean(captureProtection.multiDrm.playreadyLicenseUrl ?? captureProtection.drmLicenseUrl),
    fairplayConfigured: Boolean(captureProtection.multiDrm.fairplayLicenseUrl ?? captureProtection.drmLicenseUrl),
    fairplayCertConfigured: Boolean(captureProtection.multiDrm.fairplayCertificateUrl),
  };

  const missing: string[] = [];
  if (!mandatoryFlags.streamConfigOk) {
    missing.push("Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN, and CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN.");
  }
  if (!mandatoryFlags.signedPlaybackServerEnabled || !mandatoryFlags.signedPlaybackClientEnabled) {
    missing.push("Enable signed playback URLs on both server and client (CLOUDFLARE_STREAM_SIGNED_URLS + NEXT_PUBLIC_STREAM_SIGNED_URLS).");
  }
  if (!mandatoryFlags.streamWebhookSecretSet) {
    missing.push("Set CLOUDFLARE_STREAM_WEBHOOK_SECRET so ingest state can reliably sync to catalogue entities.");
  }
  if (!mandatoryFlags.databaseUrlSet) {
    missing.push("Set DATABASE_URL to include catalogue ingest coverage in playback readiness audits.");
  }
  if (drmFlags.drmEnabled) {
    if (!drmFlags.widevineConfigured) missing.push("Configure STORYTIME_DRM_WIDEVINE_LICENSE_URL (or STORYTIME_DRM_LICENSE_URL).");
    if (!drmFlags.playreadyConfigured) missing.push("Configure STORYTIME_DRM_PLAYREADY_LICENSE_URL (or STORYTIME_DRM_LICENSE_URL).");
    if (!drmFlags.fairplayConfigured) missing.push("Configure STORYTIME_DRM_FAIRPLAY_LICENSE_URL (or STORYTIME_DRM_LICENSE_URL).");
    if (!drmFlags.fairplayCertConfigured) missing.push("Configure STORYTIME_DRM_FAIRPLAY_CERT_URL for Safari/FairPlay devices.");
  }
  if (unresolvedCount > 0) {
    missing.push(`Resolve ${unresolvedCount} published playback URL(s) that are not stream-ready yet.`);
  }

  const report = {
    platformReadiness: {
      mandatoryFlags,
      drmFlags,
      streamAssetCount,
      publishedContentCount: contentRows.length,
      publishedEpisodeCount: episodeRows.length,
      playbackUrlsChecked: playbackUrls.length,
      streamReadyLinks: readyStreamLinkedCount,
      unresolvedPublishedUrls: unresolvedCount,
      unresolvedExamples,
    },
    missing,
  };

  console.log(JSON.stringify(report, null, 2));

  if (missing.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
