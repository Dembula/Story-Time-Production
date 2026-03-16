import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [stats, myRating] = await Promise.all([
    prisma.rating.aggregate({
      where: { contentId: id },
      _avg: { score: true },
      _count: true,
    }),
    (async () => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) return null;
      return prisma.rating.findUnique({
        where: {
          userId_contentId: { userId: session.user.id, contentId: id },
        },
      });
    })(),
  ]);

  return NextResponse.json({
    average: stats._avg.score ?? 0,
    count: stats._count,
    myRating: myRating?.score ?? null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const score = body.score;

  if (typeof score !== "number" || score < 1 || score > 5) {
    return NextResponse.json({ error: "Score must be 1-5" }, { status: 400 });
  }

  const rating = await prisma.rating.upsert({
    where: {
      userId_contentId: { userId: session.user.id, contentId: id },
    },
    create: { userId: session.user.id, contentId: id, score },
    update: { score },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(rating);
}
