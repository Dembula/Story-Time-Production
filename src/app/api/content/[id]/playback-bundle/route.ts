import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePlaybackSources } from "@/lib/playback-sources";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import {
  buildSignedCloudflarePlaybackSource,
} from "@/lib/cloudflare-stream-signed-url";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const content = await prisma.content.findFirst({
      where: { id, published: true },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        trailerUrl: true,
        posterUrl: true,
        backdropUrl: true,
        duration: true,
        type: true,
        enrichment: {
          select: {
            status: true,
            moodTags: true,
            atmosphere: true,
            pacing: true,
          },
        },
        scenes: {
          orderBy: { startSeconds: "asc" },
          take: 24,
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
      },
    });

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const signedPlayback = await buildSignedCloudflarePlaybackSource(content.videoUrl);
    const playback = signedPlayback ?? resolvePlaybackSources(content.videoUrl);
    const posterUrl = getDisplayPosterUrl(content);
    const captureProtection = getServerCaptureProtectionConfig();
    const session = await getServerSession(authOptions);

    return NextResponse.json(
      {
        id: content.id,
        title: content.title,
        playback,
        playbackProtection: {
          signedUrl: Boolean(signedPlayback),
          expiresHintSeconds: 4 * 60 * 60,
          authenticatedViewer: Boolean(session?.user?.id),
        },
        posterUrl,
        duration: content.duration,
        enrichment: content.enrichment,
        scenes: content.scenes,
        subtitles: content.subtitles,
        captureProtection: {
          enabled: captureProtection.enabled,
          mode: captureProtection.mode,
          watermarkEnabled: captureProtection.watermarkEnabled,
          drmConfigured: Boolean(captureProtection.drmLicenseUrl),
          drmLicensePath: captureProtection.drmLicenseUrl ? "/api/content/drm-license" : null,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    console.error("playback-bundle error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
