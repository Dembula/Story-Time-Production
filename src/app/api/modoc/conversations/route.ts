import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/** POST: Create a new MODOC conversation (requires auth). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { scope?: string; pageContext?: Record<string, unknown> } = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    // empty body is ok
  }

  const pageContextValue =
    body.pageContext != null ? (body.pageContext as Prisma.InputJsonValue) : Prisma.JsonNull;

  const conversation = await prisma.modocConversation.create({
    data: {
      userId,
      scope: body.scope ?? null,
      pageContext: pageContextValue,
    },
  });

  return NextResponse.json({ id: conversation.id });
}

/** GET: List current user's MODOC conversations (most recent first). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.modocConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      scope: true,
      pageContext: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      scope: c.scope,
      pageContext: c.pageContext,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
    }))
  );
}
