/**
 * Ingest catalogue videos that are still on S3/storage into Cloudflare Stream.
 *
 * Usage: npx tsx scripts/backfill-cloudflare-stream-ingest.ts [--dry-run]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "../src/lib/prisma";
import { extractCloudflareStreamUid, isCloudflareStreamUrl } from "../src/lib/cloudflare-stream";
import { linkOrIngestStreamForUrl } from "../src/lib/stream-ingest-link";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  try {
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
  } catch {
    // .env.local optional when vars are already set
  }
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const contents = await prisma.content.findMany({
    where: { videoUrl: { not: null } },
    select: { id: true, title: true, videoUrl: true, trailerUrl: true },
  });

  const episodes = await prisma.contentEpisode.findMany({
    where: { videoUrl: { not: null } },
    select: { id: true, title: true, videoUrl: true, season: { select: { contentId: true } } },
  });

  type Job = { entityType: string; entityId: string; url: string; label: string };
  const jobs: Job[] = [];

  for (const c of contents) {
    const videoUrl = c.videoUrl?.trim();
    if (videoUrl && !isCloudflareStreamUrl(videoUrl) && !extractCloudflareStreamUid(videoUrl)) {
      jobs.push({ entityType: "Content", entityId: c.id, url: videoUrl, label: `Content: ${c.title}` });
    }
    const trailerUrl = c.trailerUrl?.trim();
    if (trailerUrl && !isCloudflareStreamUrl(trailerUrl) && !extractCloudflareStreamUid(trailerUrl)) {
      jobs.push({ entityType: "Content", entityId: c.id, url: trailerUrl, label: `Trailer: ${c.title}` });
    }
  }

  for (const ep of episodes) {
    const videoUrl = ep.videoUrl?.trim();
    if (videoUrl && !isCloudflareStreamUrl(videoUrl) && !extractCloudflareStreamUid(videoUrl)) {
      jobs.push({
        entityType: "ContentEpisode",
        entityId: ep.id,
        url: videoUrl,
        label: `Episode: ${ep.title}`,
      });
    }
  }

  console.log(`Found ${jobs.length} video(s) to ingest${dryRun ? " (dry run)" : ""}.`);

  for (const job of jobs) {
    console.log(`→ ${job.label}`);
    console.log(`  ${job.url}`);
    if (dryRun) continue;
    try {
      await linkOrIngestStreamForUrl(job.url, job.entityType, job.entityId, {
        backfill: "true",
      });
      console.log("  queued/ingested");
    } catch (err) {
      console.error("  failed:", err);
    }
  }

  if (!dryRun) {
    console.log(
      "\nIngestion is async. Cloudflare will call your webhook when each video is ready;",
    );
    console.log("videoUrl fields update automatically via stream-entity-sync.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
