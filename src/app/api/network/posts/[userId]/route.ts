import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPostsByAuthorId } from "@/lib/network-db";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 50);
  const posts = await getPostsByAuthorId(userId, limit);
  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true },
  });
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
      author: author ? { id: author.id, name: author.name, image: author.image } : null,
      content: p.contentId ? contents.find((c) => c.id === p.contentId) ?? null : null,
      project: p.projectId ? projects.find((pr) => pr.id === p.projectId) ?? null : null,
    })),
  });
}
