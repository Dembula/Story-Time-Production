import "server-only";

import { prisma } from "@/lib/prisma";
import { MAX_VA_MESSAGES_IN_DB_CONTEXT } from "@/lib/modoc/learning-limits";
import type { ConversationMemory } from "../types";

export async function loadConversationMemory(params: {
  userId: string;
  conversationId?: string | null;
  pageContext?: Record<string, unknown>;
  recentUserMessages?: string[];
}): Promise<ConversationMemory> {
  const recentTurns: ConversationMemory["recentTurns"] = [];

  if (params.conversationId) {
    const conv = await prisma.modocConversation.findFirst({
      where: { id: params.conversationId, userId: params.userId },
      select: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: MAX_VA_MESSAGES_IN_DB_CONTEXT,
          select: { role: true, content: true, createdAt: true },
        },
      },
    });

    if (conv?.messages.length) {
      for (const msg of [...conv.messages].reverse()) {
        if (msg.role !== "user" && msg.role !== "assistant" && msg.role !== "system") continue;
        recentTurns.push({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content.slice(0, 2000),
          at: msg.createdAt.toISOString(),
        });
      }
    }
  }

  return {
    conversationId: params.conversationId ?? undefined,
    sessionTool: typeof params.pageContext?.tool === "string" ? params.pageContext.tool : undefined,
    sessionTask: typeof params.pageContext?.task === "string" ? params.pageContext.task : undefined,
    recentTurns,
    recentUserIntents: (params.recentUserMessages ?? []).slice(-5),
    at: new Date().toISOString(),
  };
}
