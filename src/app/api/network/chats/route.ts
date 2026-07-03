import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichNetworkUserRow } from "@/lib/network-display-name";
import { prisma } from "@/lib/prisma";

const CHAT_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  networkHandle: true,
  image: true,
} as const;

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
        include: { user: { select: CHAT_USER_SELECT } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true, email: true, networkHandle: true } } },
      },
    },
  });

  const items = conversations.map((c) => {
    const others = c.participants
      .map((p) => enrichNetworkUserRow(p.user))
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
            sender: enrichNetworkUserRow(lastMessage.sender),
          }
        : null,
    };
  });

  return NextResponse.json({ conversations: items });
}

