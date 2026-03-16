import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.watchlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      content: {
        include: { creator: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { contentId, action } = body;

  if (!contentId) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  if (action === "add") {
    await prisma.watchlistItem.upsert({
      where: {
        userId_contentId: { userId: session.user.id, contentId },
      },
      create: { userId: session.user.id, contentId },
      update: {},
    });
  } else {
    await prisma.watchlistItem.deleteMany({
      where: { userId: session.user.id, contentId },
    });
  }

  return NextResponse.json({ ok: true });
}
