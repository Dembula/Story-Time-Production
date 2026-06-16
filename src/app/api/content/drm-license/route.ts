import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getServerCaptureProtectionConfig,
  isServerDrmConfigured,
  resolveUpstreamFairplayCertificateUrl,
  resolveUpstreamLicenseUrl,
  type DrmSystemKey,
} from "@/lib/content-capture-protection";
import { extractCloudflareStreamUid } from "@/lib/cloudflare-stream";
import { findStreamAssetUidBySourceUrl } from "@/lib/stream-asset-store";
import { getViewerPlaybackState } from "@/lib/viewer-access";
import { isLongFormType } from "@/lib/content-types";

export const runtime = "nodejs";

const VALID_SYSTEMS: DrmSystemKey[] = ["widevine", "playready", "fairplay"];

function parseSystem(value: string | null): DrmSystemKey | null {
  return value && (VALID_SYSTEMS as string[]).includes(value) ? (value as DrmSystemKey) : null;
}

/** Resolve the provider asset UID for the requested content/episode/trailer. */
async function resolveAssetUid(
  contentId: string,
  episodeId: string | null,
  isTrailer: boolean,
): Promise<string | null> {
  const content = await prisma.content.findFirst({
    where: { id: contentId, published: true },
    select: {
      videoUrl: true,
      trailerUrl: true,
      type: true,
      seasons: {
        where: { published: true },
        orderBy: { seasonNumber: "asc" },
        select: { episodes: { orderBy: { episodeNumber: "asc" }, select: { id: true, videoUrl: true } } },
      },
    },
  });
  if (!content) return null;

  let videoUrl = isTrailer ? content.trailerUrl : content.videoUrl;
  if (!isTrailer && episodeId) {
    const episode = content.seasons.flatMap((s) => s.episodes).find((e) => e.id === episodeId);
    videoUrl = episode?.videoUrl ?? videoUrl;
  } else if (!isTrailer && !videoUrl && isLongFormType(content.type)) {
    videoUrl = content.seasons.flatMap((s) => s.episodes).find((e) => e.videoUrl)?.videoUrl ?? null;
  }
  if (!videoUrl) return null;

  return extractCloudflareStreamUid(videoUrl) ?? (await findStreamAssetUidBySourceUrl(videoUrl));
}

async function authorizeViewer(
  req: NextRequest,
  contentId: string,
  isTrailer: boolean,
): Promise<{ ok: true } | { ok: false; status: number }> {
  // Trailers are promotional and require no entitlement.
  if (isTrailer) return { ok: true };

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { ok: false, status: 401 };

  const playback = await getViewerPlaybackState(userId, contentId);
  if (!playback.canPlayContent) return { ok: false, status: 403 };
  return { ok: true };
}

/** FairPlay application certificate (GET, `?cert=1`). */
export async function GET(req: NextRequest) {
  const config = getServerCaptureProtectionConfig();
  if (!isServerDrmConfigured(config)) {
    return NextResponse.json({ error: "DRM not configured" }, { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const system = parseSystem(params.get("system"));
  const wantsCert = params.get("cert") === "1";
  if (system !== "fairplay" || !wantsCert) {
    return NextResponse.json({ error: "Unsupported request" }, { status: 400 });
  }

  const contentId = params.get("contentId")?.trim() ?? "";
  if (!contentId) return NextResponse.json({ error: "Missing contentId" }, { status: 400 });
  const isTrailer = params.get("trailer") === "1";

  const auth = await authorizeViewer(req, contentId, isTrailer);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const uid = await resolveAssetUid(contentId, params.get("episodeId")?.trim() || null, isTrailer);
  const certUrl = resolveUpstreamFairplayCertificateUrl(config, uid);
  if (!certUrl) return NextResponse.json({ error: "FairPlay certificate not configured" }, { status: 404 });

  const headers: Record<string, string> = {};
  if (config.drm.authToken) headers.Authorization = `Bearer ${config.drm.authToken}`;

  const certRes = await fetch(certUrl, { headers, cache: "force-cache" });
  if (!certRes.ok) {
    return NextResponse.json({ error: "Certificate fetch failed" }, { status: certRes.status });
  }
  const cert = await certRes.arrayBuffer();
  return new NextResponse(cert, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** DRM license proxy (POST). Forwards the EME challenge / SPC to the upstream license server. */
export async function POST(req: NextRequest) {
  const config = getServerCaptureProtectionConfig();
  if (!isServerDrmConfigured(config)) {
    return NextResponse.json({ error: "DRM not configured" }, { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  // Default to widevine for legacy callers that POST without a system param.
  const system = parseSystem(params.get("system")) ?? "widevine";
  const contentId = params.get("contentId")?.trim() ?? "";
  const isTrailer = params.get("trailer") === "1";

  if (contentId) {
    const auth = await authorizeViewer(req, contentId, isTrailer);
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }

  const uid = contentId
    ? await resolveAssetUid(contentId, params.get("episodeId")?.trim() || null, isTrailer)
    : null;

  const licenseUrl = resolveUpstreamLicenseUrl(config, system, uid);
  if (!licenseUrl) {
    return NextResponse.json({ error: `${system} license server not configured` }, { status: 404 });
  }

  const body = await req.arrayBuffer();
  if (!body.byteLength) {
    return NextResponse.json({ error: "Missing license challenge" }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
  if (config.drm.authToken) headers.Authorization = `Bearer ${config.drm.authToken}`;
  const contentIdHeader = req.headers.get("x-fairplay-content-id");
  if (contentIdHeader) headers["X-Fairplay-Content-Id"] = contentIdHeader;

  const licenseRes = await fetch(licenseUrl, { method: "POST", headers, body, cache: "no-store" });
  if (!licenseRes.ok) {
    const detail = await licenseRes.text().catch(() => "");
    return NextResponse.json(
      { error: detail || "License request failed" },
      { status: licenseRes.status },
    );
  }

  const license = await licenseRes.arrayBuffer();
  return new NextResponse(license, {
    status: 200,
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
  });
}
