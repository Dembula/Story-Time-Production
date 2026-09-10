import "server-only";

import { prisma } from "@/lib/prisma";
import { fetchAdminRevenueBundle } from "@/lib/admin-revenue-bundle";
import { getAdminChurnTelemetry } from "@/lib/admin/churn-telemetry";
import { getAiObservabilitySummary } from "@/lib/ai-os/observability/log-request";
import { VIEWER_CREATOR_SPLIT, VIEWER_PLATFORM_SPLIT } from "@/lib/payments/config";
import { revenueEligibleWatchSessionWhere } from "@/lib/revenue-eligible-watch";
import { alertsForOffice, detectExecutiveAnomalies } from "@/lib/executive/anomalies";
import { liveFreshness } from "@/lib/executive/freshness";
import { currentExecutivePeriod, previousCalendarMonthPeriod } from "@/lib/executive/period";
import { EXECUTIVE_RELATIONSHIP_CHAINS } from "@/lib/executive/relationships";
import type { ExecutiveOffice } from "@/lib/executive/seat-map";
import type { ExecutiveAlert, ExecutiveKpi } from "@/lib/executive/types";
import { getViewerPoolRevenue } from "@/lib/revenue";

export type ExecutiveDataBundle = {
  meta: {
    generatedAt: string;
    period: { key: string; label: string; start: string; end: string };
    comparePeriod: { key: string; label: string };
    freshnessLabel: string;
  };
  office: ExecutiveOffice;
  question: string;
  kpis: ExecutiveKpi[];
  alerts: ExecutiveAlert[];
  relationships: typeof EXECUTIVE_RELATIONSHIP_CHAINS;
  ceo: Record<string, unknown>;
  coo: Record<string, unknown>;
  cmo: Record<string, unknown>;
  cfo: Record<string, unknown>;
  cio: Record<string, unknown>;
  shared: Record<string, unknown>;
};

const bundleCache = new Map<string, { at: number; data: ExecutiveDataBundle }>();
const CACHE_TTL_MS = 45_000;

function kpi(
  id: string,
  label: string,
  value: number | string,
  extras?: Partial<ExecutiveKpi>,
): ExecutiveKpi {
  return {
    id,
    label,
    value,
    freshness: liveFreshness(),
    tone: "neutral",
    ...extras,
  };
}

export async function fetchExecutiveDataBundle(office: ExecutiveOffice): Promise<ExecutiveDataBundle> {
  const cacheKey = office;
  const hit = bundleCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const period = currentExecutivePeriod();
  const prior = previousCalendarMonthPeriod();
  const generatedAt = new Date();
  const freshness = liveFreshness(generatedAt);
  const aiSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    revenue,
    churn,
    aiSummary,
    usersTotal,
    publishedContent,
    creatorsCount,
    openIncidents,
    watchUniqueMtd,
    watchSecondsMtd,
    pipelineGroups,
    encodeGroups,
    newSubsMtd,
    activeSubs,
    analyticsTop,
    priorPool,
  ] = await Promise.all([
    fetchAdminRevenueBundle().catch(() => null),
    getAdminChurnTelemetry(80).catch(() => null),
    getAiObservabilitySummary(aiSince).catch(() => null),
    prisma.user.count().catch(() => 0),
    prisma.content.count({ where: { published: true } }).catch(() => 0),
    prisma.user.count({
      where: { OR: [{ role: "CONTENT_CREATOR" }, { role: "MUSIC_CREATOR" }] },
    }).catch(() => 0),
    prisma.opsIncident.count({ where: { resolvedAt: null } }).catch(() => 0),
    prisma.watchSession
      .groupBy({
        by: ["userId"],
        where: { startedAt: { gte: period.start, lte: period.end } },
      })
      .then((rows) => rows.length)
      .catch(() => 0),
    prisma.watchSession
      .aggregate({
        where: {
          ...revenueEligibleWatchSessionWhere,
          startedAt: { gte: period.start, lte: period.end },
        },
        _sum: { durationSeconds: true },
      })
      .then((r) => r._sum.durationSeconds ?? 0)
      .catch(() => 0),
    prisma.content
      .groupBy({ by: ["reviewStatus"], _count: { _all: true } })
      .catch(() => [] as Array<{ reviewStatus: string; _count: { _all: number } }>),
    prisma.streamAsset
      .groupBy({ by: ["status"], _count: { _all: true } })
      .catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
    prisma.viewerSubscription
      .count({
        where: {
          createdAt: { gte: period.start, lte: period.end },
          viewerModel: "SUBSCRIPTION",
        },
      })
      .catch(() => 0),
    prisma.viewerSubscription
      .count({
        where: { status: { in: ["ACTIVE", "TRIAL_ACTIVE"] }, viewerModel: "SUBSCRIPTION" },
      })
      .catch(() => 0),
    prisma.analyticsEvent
      .groupBy({
        by: ["name"],
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        _count: { _all: true },
        orderBy: { _count: { _all: "desc" } },
        take: 8,
      })
      .catch(() => [] as Array<{ name: string; _count: { _all: number } }>),
    getViewerPoolRevenue(prior.start, prior.end).catch(() => 0),
  ]);

  const viewerPool = revenue?.viewerSub?.viewerSubRevenue ?? revenue?.platform?.revenuePool ?? 0;
  const creatorPool =
    revenue?.viewerSub?.creatorPoolFromSubs ?? viewerPool * VIEWER_CREATOR_SPLIT;
  const platformCut =
    revenue?.viewerSub?.storyTimeFromSubs ?? viewerPool * VIEWER_PLATFORM_SPLIT;
  const churnRisk =
    (churn?.metrics?.subscriptionsCancelled ?? 0) +
    (churn?.metrics?.subscriptionsScheduledCancel ?? 0) +
    (churn?.metrics?.subscriptionsPastDue ?? 0);
  const failedPayments =
    (churn?.metrics?.gatewayPaymentsFailed ?? 0) +
    (churn?.metrics?.viewerRenewalPaymentsFailed ?? 0) +
    (churn?.metrics?.marketplaceTransactionsFailed ?? 0);
  const encodeFailed = encodeGroups
    .filter((g) => /fail|error/i.test(g.status))
    .reduce((s, g) => s + g._count._all, 0);
  const encodeQueued = encodeGroups
    .filter((g) => /queue|pending|waiting/i.test(g.status))
    .reduce((s, g) => s + g._count._all, 0);
  const encodeProcessing = encodeGroups
    .filter((g) => /encod|process|compress/i.test(g.status))
    .reduce((s, g) => s + g._count._all, 0);
  const encodeReady = encodeGroups
    .filter((g) => /ready|complete|done/i.test(g.status))
    .reduce((s, g) => s + g._count._all, 0);

  const pipeline: Record<string, number> = {};
  for (const row of pipelineGroups) {
    pipeline[row.reviewStatus] = row._count._all;
  }

  const aiErrorRatePct = aiSummary?.errorRate ?? 0;

  const topTitles = (revenue?.contentRevenue ?? []).slice(0, 8).map((c) => ({
    id: c.id,
    title: c.title,
    watchTime: c.watchTime,
    revenue: Math.round(c.revenue * 100) / 100,
    share: Math.round(c.share * 10) / 10,
    creatorName: c.creatorName,
  }));

  const alerts = detectExecutiveAnomalies({
    churnRiskCount: churnRisk,
    openIncidents,
    encodeFailed,
    aiErrorRatePct,
    revenueNetZar: viewerPool,
    priorRevenueNetZar: priorPool,
  });

  const growthPct =
    priorPool > 0 ? Math.round(((viewerPool - priorPool) / priorPool) * 1000) / 10 : null;

  const shared = {
    usersTotal,
    publishedContent,
    creatorsCount,
    openIncidents,
    watchUniqueMtd,
    watchHoursMtd: Math.round((watchSecondsMtd / 3600) * 10) / 10,
    viewerPool,
    creatorPool,
    platformCut,
    churnRisk,
    activeSubs,
    newSubsMtd,
    growthPct,
  };

  const ceo = {
    ...shared,
    topCreators: (revenue?.creators ?? []).slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      revenue: c.revenue,
      watchTime: c.watchTime,
    })),
    topTitles,
  };

  const coo = {
    pipeline,
    awaitingReview: (pipeline.PENDING_REVIEW ?? 0) + (pipeline.IN_REVIEW ?? 0) + (pipeline.CHANGES_REQUESTED ?? 0),
    approved: pipeline.APPROVED ?? 0,
    rejected: pipeline.REJECTED ?? 0,
    draft: pipeline.DRAFT ?? 0,
    encode: { queued: encodeQueued, processing: encodeProcessing, failed: encodeFailed, ready: encodeReady },
    openIncidents,
    topTitles,
    opsHref: "/admin/content",
  };

  const cmo = {
    activeSubs,
    newSubsMtd,
    churnRisk,
    watchUniqueMtd,
    watchHoursMtd: shared.watchHoursMtd,
    topEvents: analyticsTop.map((e) => ({ name: e.name, count: e._count._all })),
    funnelNote:
      "Campaign spend / CAC / ROAS require marketing cost sources — structure ready; acquisition volumes use subscriptions + product events.",
    sourcePending: ["campaignSpend", "cac", "roas", "ltvCohorts"],
  };

  const cfo = {
    viewerPool,
    creatorPool,
    platformCut,
    companySubs: revenue?.companySubs?.revenue ?? 0,
    distribution: revenue?.distributionLicenses?.revenue ?? 0,
    marketplaceFees: revenue?.transactionFees?.totalFees ?? 0,
    appleIap: revenue?.appleIap?.revenue ?? 0,
    treasuryAvailable: revenue?.treasury?.availableBalance ?? 0,
    treasuryPending: revenue?.treasury?.pendingBalance ?? 0,
    failedPayments,
    topTitles,
    priorPool,
    creatorSplitPct: Math.round(VIEWER_CREATOR_SPLIT * 100),
    platformSplitPct: Math.round(VIEWER_PLATFORM_SPLIT * 100),
  };

  const cio = {
    ai: aiSummary
      ? {
          totalRequests: aiSummary.totalRequests,
          errorRatePct: aiErrorRatePct,
          avgLatencyMs: aiSummary.avgLatencyMs,
          ragHitRate: aiSummary.ragHitRate,
        }
      : null,
    encode: { queued: encodeQueued, processing: encodeProcessing, failed: encodeFailed, ready: encodeReady },
    openIncidents,
    sourcePending: ["cdnErrors", "ttff", "bufferingRate", "infraCost"],
  };

  const officeKpis: Record<ExecutiveOffice, ExecutiveKpi[]> = {
    CEO: [
      kpi("revenue", "Viewer pool (MTD net)", viewerPool, { unit: "ZAR", tone: "good", deltaPct: growthPct }),
      kpi("creator-pool", "Creator pool", creatorPool, { unit: "ZAR" }),
      kpi("active-subs", "Active subscribers", activeSubs, { tone: "good" }),
      kpi("new-subs", "New subscribers (MTD)", newSubsMtd),
      kpi("churn-risk", "Churn / past-due risk", churnRisk, { tone: churnRisk > 10 ? "warn" : "neutral" }),
      kpi("mau", "Unique watchers (MTD)", watchUniqueMtd),
      kpi("creators", "Creators", creatorsCount),
      kpi("library", "Published titles", publishedContent),
      kpi("incidents", "Open incidents", openIncidents, { tone: openIncidents > 0 ? "bad" : "good" }),
    ],
    COO: [
      kpi("awaiting", "Content awaiting review", (pipeline.PENDING_REVIEW ?? 0) + (pipeline.IN_REVIEW ?? 0), {
        tone: "warn",
      }),
      kpi("approved", "Approved / published status", pipeline.APPROVED ?? 0, { tone: "good" }),
      kpi("encode-fail", "Encode failures", encodeFailed, { tone: encodeFailed > 0 ? "bad" : "good" }),
      kpi("encode-queue", "Encode queued", encodeQueued),
      kpi("watch-hours", "Eligible watch hours (MTD)", shared.watchHoursMtd),
      kpi("incidents", "Ops incidents", openIncidents, { tone: openIncidents > 0 ? "bad" : "good" }),
    ],
    CMO: [
      kpi("active-subs", "Active subscribers", activeSubs, { tone: "good" }),
      kpi("new-subs", "New subs (MTD)", newSubsMtd),
      kpi("churn-risk", "Churn risk set", churnRisk, { tone: churnRisk > 10 ? "warn" : "neutral" }),
      kpi("watchers", "Unique watchers (MTD)", watchUniqueMtd),
      kpi("watch-hours", "Watch hours (eligible MTD)", shared.watchHoursMtd),
      kpi("events", "Top analytics event volume", analyticsTop[0]?._count._all ?? 0),
    ],
    CFO: [
      kpi("viewer-pool", "Viewer pool net (MTD)", viewerPool, { unit: "ZAR", tone: "good", deltaPct: growthPct }),
      kpi("creator-pool", "Creator pool (MTD)", creatorPool, { unit: "ZAR" }),
      kpi("platform-cut", "Platform retain (MTD)", platformCut, { unit: "ZAR" }),
      kpi("company", "Company listing revenue", revenue?.companySubs?.revenue ?? 0, { unit: "ZAR" }),
      kpi("treasury", "Treasury available", revenue?.treasury?.availableBalance ?? 0, { unit: "ZAR" }),
      kpi("failed", "Failed payment signals", failedPayments, {
        tone: failedPayments > 0 ? "warn" : "good",
      }),
    ],
    CIO: [
      kpi("ai-req", "AI requests (24h)", aiSummary?.totalRequests ?? 0),
      kpi("ai-err", "AI error rate", aiErrorRatePct, { unit: "%", tone: aiErrorRatePct >= 10 ? "bad" : "good" }),
      kpi("ai-lat", "AI avg latency", aiSummary?.avgLatencyMs ?? 0, { unit: "ms" }),
      kpi("encode-fail", "Encode failures", encodeFailed, { tone: encodeFailed > 0 ? "bad" : "good" }),
      kpi("encode-queue", "Encode queue", encodeQueued),
      kpi("incidents", "Open incidents", openIncidents, { tone: openIncidents > 0 ? "bad" : "good" }),
    ],
  };

  const questions: Record<ExecutiveOffice, string> = {
    CEO: "Is the company healthy and growing?",
    COO: "Is Story Time's content and operation running properly?",
    CMO: "Are we acquiring, engaging and retaining viewers?",
    CFO: "Is the Story Time economy financially healthy?",
    CIO: "Is the technology healthy, secure, scalable and efficient?",
  };

  const data: ExecutiveDataBundle = {
    meta: {
      generatedAt: generatedAt.toISOString(),
      period: {
        key: period.key,
        label: period.label,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      comparePeriod: { key: prior.key, label: prior.label },
      freshnessLabel: freshness.label,
    },
    office,
    question: questions[office],
    kpis: officeKpis[office].map((k) => ({ ...k, freshness })),
    alerts: alertsForOffice(alerts, office),
    relationships: EXECUTIVE_RELATIONSHIP_CHAINS,
    ceo,
    coo,
    cmo,
    cfo,
    cio,
    shared,
  };

  bundleCache.set(cacheKey, { at: Date.now(), data });
  return data;
}
