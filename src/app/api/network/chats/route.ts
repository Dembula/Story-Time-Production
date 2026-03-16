import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = session.user.id;

  const conversations = await prisma.networkConversation.findMany({
    where: {
      participants: {
        some: { userId: me },
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });

  const items = conversations.map((c) => {
    const others = c.participants
      .map((p) => p.user)
      .filter((u) => u.id !== me);
    const lastMessage = c.messages[0];
    return {
      id: c.id,
      participants: others,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            body: lastMessage.body,
            createdAt: lastMessage.createdAt,
            sender: { id: lastMessage.sender.id, name: lastMessage.sender.name },
          }
        : null,
    };
  });

  return NextResponse.json({ conversations: items });
}

