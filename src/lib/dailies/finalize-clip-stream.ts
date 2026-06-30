import { prisma } from "@/lib/prisma";
import { linkOrIngestStreamForUrl, resolveStreamPlaybackUrl } from "@/lib/stream-ingest-link";

export async function finalizeDailiesClipStream(params: {
  clipId: string;
  videoUrl: string;
  projectId: string;
}): Promise<void> {
  const streamAsset = await linkOrIngestStreamForUrl(params.videoUrl, "DailiesClip", params.clipId, {
    area: "dailies",
    projectId: params.projectId,
  });
  const streamPlayback = resolveStreamPlaybackUrl(streamAsset);
  await prisma.dailiesClip.update({
    where: { id: params.clipId },
    data: {
      proxyUrl: streamPlayback,
      streamStatus: "ready",
    },
  });
}

export async function finalizeDailiesBatchStream(params: {
  batchId: string;
  clipId: string | null;
  videoUrl: string;
  projectId: string;
}): Promise<void> {
  await linkOrIngestStreamForUrl(params.videoUrl, "DailiesBatch", params.batchId, {
    area: "dailies",
    projectId: params.projectId,
  });
  if (params.clipId) {
    await finalizeDailiesClipStream({
      clipId: params.clipId,
      videoUrl: params.videoUrl,
      projectId: params.projectId,
    });
  }
}
