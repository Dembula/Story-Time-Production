import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const conversation = await prisma.modocConversation.findUnique({
    where: { id },
    select: {
      id: true,
      scope: true,
      pageContext: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [actions, sessionIntel, recentRequests] = await Promise.all([
    prisma.modocActionLog.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        action: true,
        ok: true,
        message: true,
        projectId: true,
        createdAt: true,
      },
    }),
    prisma.modocSessionIntel.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        userIntent: true,
        nextBestAction: true,
        nextBestActionScore: true,
        suggestionAcceptanceRate: true,
        modelUsed: true,
        createdAt: true,
      },
    }),
    conversation.user?.id
      ? prisma.aiRequestLog.findMany({
          where: {
            userId: conversation.user.id,
            route: { in: ["modoc/chat", "playback/companion"] },
            createdAt: { gte: new Date(conversation.createdAt.getTime() - 60_000) },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            route: true,
            agentId: true,
            modelUsed: true,
            taskKind: true,
            latencyMs: true,
            success: true,
            ragHitCount: true,
            createdAt: true,
            metadata: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const ctxObj = asRecord(conversation.pageContext);

  return NextResponse.json({
    ok: true,
    conversation: {
      id: conversation.id,
      scope: conversation.scope,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      pageContext: ctxObj,
      user: conversation.user,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      actions: actions.map((a) => ({
        id: a.id,
        action: a.action,
        ok: a.ok,
        message: a.message,
        projectId: a.projectId,
        createdAt: a.createdAt.toISOString(),
      })),
      sessionIntel: sessionIntel.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
      relatedRequests: recentRequests.map((r) => ({
        id: r.id,
        route: r.route,
        agentId: r.agentId,
        modelUsed: r.modelUsed,
        taskKind: r.taskKind,
        latencyMs: r.latencyMs,
        success: r.success,
        ragHitCount: r.ragHitCount,
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata,
      })),
    },
  });
}
