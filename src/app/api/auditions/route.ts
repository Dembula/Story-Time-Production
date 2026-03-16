import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;
  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("contentId");
  const scope = searchParams.get("scope");

  // Allow agencies to see a global feed of open auditions
  if (role === "CASTING_AGENCY" && scope === "feed") {
    const auditions = await prisma.auditionPost.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: {
        content: { select: { title: true } },
        creator: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(auditions);
  }

  if (contentId) {
    const auditions = await prisma.auditionPost.findMany({
      where: { contentId },
      orderBy: { createdAt: "desc" },
      include: { content: { select: { title: true } } },
    });
    return NextResponse.json(auditions);
  }

  let creatorId = userId;
  if (role === "ADMIN") {
    const first = await prisma.user.findFirst({ where: { role: "CONTENT_CREATOR" } });
    creatorId = first?.id || userId;
  }

  const auditions = await prisma.auditionPost.findMany({
    where: { creatorId: creatorId! },
    orderBy: { createdAt: "desc" },
    include: { content: { select: { title: true } } },
  });
  return NextResponse.json(auditions);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id;
  const body = await req.json();
  const audition = await prisma.auditionPost.create({
    data: {
      roleName: body.roleName,
      description: body.description || null,
      status: body.status || "OPEN",
      contentId: body.contentId,
      creatorId: userId!,
    },
  });
  return NextResponse.json(audition);
}
