import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createNetworkPost,
  getFeedPostIdsForUser,
  getPublicFeedPostIds,
  getPostsByIds,
} from "@/lib/network-db";
import { enrichNetworkPostsForFeed } from "@/lib/network-post-enrich";
import { validateStorageUrlList } from "@/lib/storage-origin";

function serializeUrlList(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const urls = value.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim());
    return urls.length > 0 ? JSON.stringify(urls) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("[")) return trimmed;
    return JSON.stringify([trimmed]);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "feed";
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 50);

  let postIds: string[];
  if (mode === "feed" && session?.user?.id) {
    postIds = await getFeedPostIdsForUser(session.user.id, limit);
  } else {
    postIds = await getPublicFeedPostIds(limit);
  }

  const rows = await getPostsByIds(postIds);
  const enriched = await enrichNetworkPostsForFeed(rows, session?.user?.id ?? null);

  return NextResponse.json({ posts: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    body?: string;
    imageUrls?: string | string[];
    videoUrls?: string | string[];
    contentId?: string;
  };

  const imageErr = validateStorageUrlList(body.imageUrls, "imageUrls");
  if (imageErr) return NextResponse.json({ error: imageErr }, { status: 400 });
  const videoErr = validateStorageUrlList(body.videoUrls, "videoUrls");
  if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });

  const text = typeof body.body === "string" ? body.body.trim() : "";
  const imageStr = serializeUrlList(body.imageUrls);
  const videoStr = serializeUrlList(body.videoUrls);

  if (!text && !imageStr && !videoStr && typeof body.contentId !== "string") {
    return NextResponse.json({ error: "Post needs text, an image, or a video." }, { status: 400 });
  }

  const postType = videoStr ? "VIDEO" : imageStr ? "IMAGE" : "TEXT_UPDATE";

  const post = await createNetworkPost(session.user.id, {
    body: text || null,
    imageUrls: imageStr,
    videoUrls: videoStr,
    contentId: typeof body.contentId === "string" ? body.contentId : null,
    projectId: null,
    sceneId: null,
    productionPhase: null,
    postType,
    metadata: null,
  });

  const [enriched] = await enrichNetworkPostsForFeed([post], session.user.id);
  return NextResponse.json(enriched);
}
