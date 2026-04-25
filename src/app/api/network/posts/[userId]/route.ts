import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPostsByAuthorId } from "@/lib/network-db";
import { prisma } from "@/lib/prisma";
import { enrichNetworkPostsForFeed } from "@/lib/network-post-enrich";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  const { userId } = await params;
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 50);
  const rows = await getPostsByAuthorId(userId, limit);
  const enriched = await enrichNetworkPostsForFeed(rows, session?.user?.id ?? null);

  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      professionalName: true,
      image: true,
      headline: true,
      primaryRole: true,
    },
  });

  return NextResponse.json({
    posts: enriched.map((p) => ({
      ...p,
      author: author
        ? {
            id: author.id,
            name: author.professionalName || author.name,
            image: author.image,
            headline: author.headline,
            primaryRole: author.primaryRole,
          }
        : p.author,
    })),
  });
}
