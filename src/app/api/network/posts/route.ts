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
    contentId?: string;
  };
  const imageErr = validateStorageUrlList(body.imageUrls, "imageUrls");
  if (imageErr) return NextResponse.json({ error: imageErr }, { status: 400 });

  const imageStr =
    body.imageUrls == null
      ? null
      : Array.isArray(body.imageUrls)
        ? JSON.stringify(body.imageUrls)
        : typeof body.imageUrls === "string"
          ? body.imageUrls
          : null;

  const post = await createNetworkPost(session.user.id, {
    body: typeof body.body === "string" ? body.body : null,
    imageUrls: imageStr,
    contentId: typeof body.contentId === "string" ? body.contentId : null,
    projectId: null,
    sceneId: null,
    productionPhase: null,
    postType: "TEXT_UPDATE",
    videoUrls: null,
    metadata: null,
  });

  const [enriched] = await enrichNetworkPostsForFeed([post], session.user.id);
  return NextResponse.json(enriched);
}
