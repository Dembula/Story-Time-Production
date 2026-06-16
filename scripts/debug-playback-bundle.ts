import { resolvePublishedContentVideoUrl } from "../src/lib/playback-content-url";
import { resolveServerPlaybackSource } from "../src/lib/server-playback-sources";
import { prisma } from "../src/lib/prisma";
import { getDisplayPosterUrl } from "../src/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "../src/lib/content-capture-protection";
import { requiresSignedStreamPlayback } from "../src/lib/cloudflare-stream-signed-url";
import { parsePlatformScriptVersionId } from "../src/lib/content-catalogue-tags";

function contentHasScriptSource(input: {
  scriptUrl?: string | null;
  tags?: string | null;
  linkedProjectId?: string | null;
}): boolean {
  return Boolean(
    input.scriptUrl?.trim() ||
      input.linkedProjectId?.trim() ||
      parsePlatformScriptVersionId(input.tags),
  );
}

const id = process.argv[2] ?? "cmqgm8ztr0001lc2b60lkd4ly";

async function main() {
  const videoUrl = await resolvePublishedContentVideoUrl(id);
  console.log("videoUrl", videoUrl?.slice(0, 120) ?? null);

  const content = await prisma.content.findFirst({
    where: { id, published: true },
    select: {
      id: true,
      title: true,
      posterUrl: true,
      backdropUrl: true,
      duration: true,
      linkedProjectId: true,
      scriptUrl: true,
      tags: true,
      enrichment: {
        select: {
          status: true,
          moodTags: true,
          atmosphere: true,
          pacing: true,
          narrativeJson: true,
        },
      },
      scenes: {
        orderBy: { startSeconds: "asc" },
        take: 64,
        select: {
          id: true,
          startSeconds: true,
          endSeconds: true,
          summary: true,
          mood: true,
          actors: true,
        },
      },
      subtitles: {
        select: { id: true, language: true, label: true, vttUrl: true, isDefault: true },
      },
      seasons: {
        where: { published: true },
        select: { episodes: { select: { id: true, duration: true } } },
      },
    },
  });

  if (!content) {
    console.log("content not found");
    return;
  }

  console.log("title", content.title);
  const upstream = await resolveServerPlaybackSource(videoUrl);
  console.log("upstream", upstream);
  console.log("poster", getDisplayPosterUrl(content));
  console.log("capture", getServerCaptureProtectionConfig());
  console.log("signedRequired", requiresSignedStreamPlayback());
  console.log("hasScript", contentHasScriptSource(content));
  console.log("scenes", content.scenes.length);
}

main()
  .catch((err) => {
    console.error("FAILED", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
