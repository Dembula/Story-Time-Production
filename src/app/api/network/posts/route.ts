import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createPost,
  getFeedPostIdsForUser,
  getPublicFeedPostIds,
  getPostsByIds,
} from "@/lib/network-db";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "feed"; // "feed" | "discover"
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 50);

  let postIds: string[];
  if (mode === "feed" && session?.user?.id) {
    postIds = await getFeedPostIdsForUser(session.user.id, limit);
  } else {
    postIds = await getPublicFeedPostIds(limit);
  }

  const posts = await getPostsByIds(postIds);
  const authorIds = [...new Set(posts.map((p) => p.authorId))];
  const authors =
    authorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

  const authorMap = Object.fromEntries(
    authors.map((a) => [a.id, { id: a.id, name: a.name, image: a.image, headline: null as string | null }])
  );

  const contentIds = [...new Set(posts.map((p) => p.contentId).filter(Boolean))] as string[];
  const projectIds = [...new Set(posts.map((p) => p.projectId).filter(Boolean))] as string[];
  const contents =
    contentIds.length > 0
      ? await prisma.content.findMany({
          where: { id: { in: contentIds } },
          select: { id: true, title: true, type: true, posterUrl: true },
        })
      : [];
  const projects =
    projectIds.length > 0
      ? await prisma.originalProject.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, title: true, type: true, posterUrl: true },
        })
      : [];

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      author: authorMap[p.authorId] ?? { id: p.authorId, name: null, image: null, headline: null },
      content: p.contentId ? contents.find((c) => c.id === p.contentId) ?? null : null,
      project: p.projectId ? projects.find((pr) => pr.id === p.projectId) ?? null : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { body: text, imageUrls, contentId, projectId } = body as {
    body?: string;
    imageUrls?: string | string[];
    contentId?: string;
    projectId?: string;
  };

  const imageStr =
    imageUrls == null
      ? null
      : Array.isArray(imageUrls)
        ? JSON.stringify(imageUrls)
        : typeof imageUrls === "string"
          ? imageUrls
          : null;

  const post = await createPost(
    session.user.id,
    typeof text === "string" ? text : null,
    imageStr,
    typeof contentId === "string" ? contentId : null,
    typeof projectId === "string" ? projectId : null
  );
  return NextResponse.json(post);
}
