import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contentId = searchParams.get("contentId");

  if (contentId) {
    const crew = await prisma.crewMember.findMany({
      where: { contentId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(crew);
  }

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;

  let creatorId = userId;
  if (role === "ADMIN") {
    const first = await prisma.user.findFirst({ where: { role: "CONTENT_CREATOR" } });
    creatorId = first?.id || userId;
  }

  const contents = await prisma.content.findMany({
    where: { creatorId: creatorId! },
    select: {
      id: true,
      title: true,
      crewMembers: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json(contents);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const crew = await prisma.crewMember.create({
    data: {
      name: body.name,
      role: body.role,
      bio: body.bio || null,
      contentId: body.contentId,
    },
  });
  return NextResponse.json(crew);
}
