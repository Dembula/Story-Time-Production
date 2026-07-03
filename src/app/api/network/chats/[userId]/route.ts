import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { areConnected } from "@/lib/network-db";
import { enrichNetworkUserRow } from "@/lib/network-display-name";

const SENDER_SELECT = {
  id: true,
  name: true,
  email: true,
  networkHandle: true,
} as const;

async function getOrCreateConversation(me: string, otherId: string) {
  const existing = await prisma.networkConversation.findFirst({
    where: {
      participants: {
        every: {
          OR: [{ userId: me }, { userId: otherId }],
        },
      },
    },
    include: {
      participants: true,
    },
  });
  if (existing) return existing;

  const conversation = await prisma.networkConversation.create({
    data: {
      participants: {
        create: [{ userId: me }, { userId: otherId }],
      },
    },
  });
  return conversation;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;
  const { userId: otherId } = await context.params;

  if (!(await areConnected(me, otherId))) {
    return NextResponse.json({ error: "Not connected" }, { status: 403 });
  }

  const conversation = await getOrCreateConversation(me, otherId);

  const messages = await prisma.networkMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: SENDER_SELECT },
    },
  });

  return NextResponse.json({
    conversationId: conversation.id,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      sender: enrichNetworkUserRow(m.sender),
    })),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;
  const { userId: otherId } = await context.params;

  if (!(await areConnected(me, otherId))) {
    return NextResponse.json({ error: "Not connected" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  if (!body?.body || !body.body.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const conversation = await getOrCreateConversation(me, otherId);

  const message = await prisma.networkMessage.create({
    data: {
      conversationId: conversation.id,
      senderId: me,
      body: body.body.trim(),
    },
    include: {
      sender: { select: SENDER_SELECT },
    },
  });

  await prisma.networkConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    sender: enrichNetworkUserRow(message.sender),
  });
}
