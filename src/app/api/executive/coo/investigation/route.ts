import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExecutiveActor } from "@/lib/executive/seats";
import { writeExecutiveAudit } from "@/lib/executive/audit";
import { getCalendarMonthToDateRange } from "@/lib/financial-ledger";
import { revenueEligibleWatchSessionWhere } from "@/lib/revenue-eligible-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** COO/CEO investigation: content pipeline + top titles + encode health (read-only). */
export async function GET() {
  const actor = await requireExecutiveActor();
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }
  if (actor.office !== "COO" && actor.office !== "CEO") {
    return NextResponse.json({ error: "COO investigation is limited to COO and CEO seats." }, { status: 403 });
  }

  const { periodStart, periodEnd } = getCalendarMonthToDateRange();

  const [pipeline, awaiting, topWatch, encodeGroups, recentPublished] = await Promise.all([
    prisma.content.groupBy({ by: ["reviewStatus"], _count: { _all: true } }),
    prisma.content.findMany({
      where: { reviewStatus: { in: ["PENDING_REVIEW", "IN_REVIEW", "CHANGES_REQUESTED"] } },
      select: {
        id: true,
        title: true,
        type: true,
        reviewStatus: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 40,
    }),
    prisma.watchSession.groupBy({
      by: ["contentId"],
      where: {
        ...revenueEligibleWatchSessionWhere,
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
      _count: { _all: true },
      orderBy: { _sum: { durationSeconds: "desc" } },
      take: 15,
    }),
    prisma.streamAsset.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.content.findMany({
      where: { published: true, reviewStatus: "APPROVED" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        type: true,
        creator: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const contentIds = topWatch.map((t) => t.contentId);
  const titles =
    contentIds.length === 0
      ? []
      : await prisma.content.findMany({
          where: { id: { in: contentIds } },
          select: { id: true, title: true, type: true, creator: { select: { name: true } } },
        });
  const titleById = new Map(titles.map((t) => [t.id, t]));

  await writeExecutiveAudit({
    userId: actor.userId,
    email: actor.email,
    office: actor.office,
    action: "VIEW_COO_INVESTIGATION",
  });

  return NextResponse.json({
    pipeline: Object.fromEntries(pipeline.map((p) => [p.reviewStatus, p._count._all])),
    awaitingReview: awaiting.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      reviewStatus: c.reviewStatus,
      updatedAt: c.updatedAt.toISOString(),
      creator: c.creator,
      reviewHref: `/admin/content/${c.id}`,
    })),
    topTitlesMtd: topWatch.map((t) => ({
      contentId: t.contentId,
      title: titleById.get(t.contentId)?.title ?? "Untitled",
      type: titleById.get(t.contentId)?.type ?? null,
      creatorName: titleById.get(t.contentId)?.creator?.name ?? null,
      watchSeconds: t._sum.durationSeconds ?? 0,
      sessions: t._count._all,
    })),
    encode: Object.fromEntries(encodeGroups.map((g) => [g.status, g._count._all])),
    recentPublished: recentPublished.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      updatedAt: c.updatedAt.toISOString(),
      creator: c.creator,
    })),
    opsConsoleHref: "/admin/content",
  });
}
