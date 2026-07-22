import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const scope = url.searchParams.get("scope")?.trim() || "";
  const userRole = url.searchParams.get("role")?.trim() || "";
  const cursor = url.searchParams.get("cursor")?.trim() || "";
  const take = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10) || 25));

  const where: Record<string, unknown> = {};

  if (scope) where.scope = scope;

  const userFilter: Record<string, unknown> = {};
  if (userRole) userFilter.role = userRole;
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (Object.keys(userFilter).length > 0) {
    where.user = userFilter;
  }

  const rows = await prisma.modocConversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      scope: true,
      pageContext: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { role: true, content: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  const conversationIds = page.map((r) => r.id);
  const actionCounts =
    conversationIds.length > 0
      ? await prisma.modocActionLog.groupBy({
          by: ["conversationId"],
          where: { conversationId: { in: conversationIds } },
          _count: { _all: true },
        })
      : [];
  const actionsByConversation = new Map(
    actionCounts
      .filter((r) => r.conversationId)
      .map((r) => [r.conversationId as string, r._count._all]),
  );

  return NextResponse.json({
    ok: true,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    conversations: page.map((row) => {
      const ctx = asRecord(row.pageContext);
      const last = row.messages[0] ?? null;
      return {
        id: row.id,
        scope: row.scope,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        messageCount: row._count.messages,
        actionCount: actionsByConversation.get(row.id) ?? 0,
        user: row.user,
        pageContext: {
          pathname: typeof ctx?.pathname === "string" ? ctx.pathname : null,
          projectId: typeof ctx?.projectId === "string" ? ctx.projectId : null,
          tool: typeof ctx?.tool === "string" ? ctx.tool : null,
          task: typeof ctx?.task === "string" ? ctx.task : null,
          area: typeof ctx?.area === "string" ? ctx.area : null,
          contentId: typeof ctx?.contentId === "string" ? ctx.contentId : null,
        },
        lastMessage: last
          ? {
              role: last.role,
              preview: last.content.slice(0, 180),
              createdAt: last.createdAt.toISOString(),
            }
          : null,
      };
    }),
  });
}
