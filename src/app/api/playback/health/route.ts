import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCloudflareStreamConfig } from "@/lib/cloudflare-stream";
import { resolveDrmEndpoints, buildDrmClientHint } from "@/lib/playback/drm";
import { isCloudflareSignedPlaybackEnabled } from "@/lib/cloudflare-stream-signed-url";

export const runtime = "nodejs";

/**
 * Read-only diagnostic so creators / admins / SRE can verify the playback pipeline
 * end-to-end without spelunking through logs. Returns booleans (never secrets) so it
 * is safe to expose to authenticated users; un-authenticated requests get a minimal
 * health summary.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "ADMIN" ||
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin === true;

  const cf = getCloudflareStreamConfig();
  const drm = resolveDrmEndpoints(null);
  const drmClient = buildDrmClientHint(drm);
  const signedEnabled = isCloudflareSignedPlaybackEnabled();
  const signingKeyConfigured = Boolean(
    process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID &&
      (process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM || process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK),
  );

  const status = {
    ok: true,
    stream: {
      cloudflareConfigured: Boolean(cf),
      signedPlaybackEnabled: signedEnabled,
      signingKeyConfigured,
      webhookSecretConfigured: Boolean(process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET),
      nativeDrmEnabled: process.env.CLOUDFLARE_STREAM_DRM_NATIVE === "true",
    },
    drm: {
      mode: process.env.CAPTURE_PROTECTION_MODE === "drm" ? "drm" : "standard",
      enabled: drm.enabled,
      systems: drmClient.systems,
      proxy: drmClient.proxy,
    },
    capture: {
      protectionEnabled: process.env.CAPTURE_PROTECTION_ENABLED !== "false",
      watermarkEnabled: process.env.CAPTURE_WATERMARK_ENABLED !== "false",
    },
  };

  if (!isAdmin) {
    return NextResponse.json(status, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Admin-only diagnostic data: catalogue/transcoding health snapshot.
  type AssetRow = { status: string | null; count: bigint };
  const recentAssets = (await prisma.$queryRaw`
    SELECT status, COUNT(*)::bigint AS count
    FROM "StreamAsset"
    WHERE "updatedAt" > NOW() - INTERVAL '7 days'
    GROUP BY status
  `) as AssetRow[];

  const titlesMissingVideo = await prisma.content.count({
    where: { published: true, videoUrl: null, type: { in: ["FILM", "MOVIE", "SHORT_FILM", "DOCUMENTARY"] } },
  });
  const titlesMissingTrailer = await prisma.content.count({
    where: { published: true, trailerUrl: null, type: { in: ["FILM", "MOVIE", "SHORT_FILM", "DOCUMENTARY", "SERIES"] } },
  });

  return NextResponse.json(
    {
      ...status,
      catalogue: {
        titlesMissingVideo,
        titlesMissingTrailer,
      },
      transcoding: {
        last7Days: Object.fromEntries(recentAssets.map((row) => [row.status ?? "unknown", Number(row.count)])),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
