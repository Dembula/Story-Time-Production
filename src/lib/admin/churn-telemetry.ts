import { prisma } from "@/lib/prisma";
import {
  formatCreatorLicenseSummary,
  getCompanyPlanConfig,
  getViewerPlanConfigById,
} from "@/lib/pricing";
import { PAYMENT_PURPOSE_LABELS } from "@/lib/admin/payment-transaction-detail.types";

const db = prisma as any;

const COMPANY_TYPE_LABELS: Record<string, string> = {
  CREW_TEAM: "Crew team",
  CASTING_AGENCY: "Casting agency",
  LOCATION_OWNER: "Location owner",
  EQUIPMENT_COMPANY: "Equipment company",
  CATERING_COMPANY: "Catering company",
};

export type ChurnSubscriptionRow = {
  id: string;
  segment: "viewer" | "company" | "creator";
  segmentLabel: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  plan: string;
  planLabel: string;
  status: string;
  churnState: "cancelled" | "scheduled_cancel" | "past_due";
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
  lastPaymentAt: string | null;
  lastPaymentError: string | null;
  updatedAt: string;
};

export type ChurnTransactionRow = {
  id: string;
  source: "gateway_payment" | "marketplace" | "viewer_subscription_payment";
  status: string;
  amount: number;
  purpose: string | null;
  purposeLabel: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  counterpartyName: string | null;
  counterpartyRole: string | null;
  createdAt: string;
  failedAt: string | null;
  failureReason: string | null;
};

export type AdminChurnMetrics = {
  subscriptionsCancelled: number;
  subscriptionsScheduledCancel: number;
  subscriptionsPastDue: number;
  viewerCancelled: number;
  viewerScheduledCancel: number;
  companyCancelled: number;
  companyScheduledCancel: number;
  creatorCancelled: number;
  creatorScheduledCancel: number;
  gatewayPaymentsCancelled: number;
  gatewayPaymentsFailed: number;
  marketplaceTransactionsFailed: number;
  viewerRenewalPaymentsFailed: number;
};

function resolveChurnState(row: {
  status: string;
  cancelAtPeriodEnd: boolean;
}): ChurnSubscriptionRow["churnState"] {
  if (row.status === "PAST_DUE") return "past_due";
  if (row.status === "CANCELLED") return "cancelled";
  if (row.cancelAtPeriodEnd) return "scheduled_cancel";
  return "cancelled";
}

function mapViewerSubscription(sub: any): ChurnSubscriptionRow {
  const planConfig = getViewerPlanConfigById(sub.plan);
  return {
    id: sub.id,
    segment: "viewer",
    segmentLabel: "Viewer subscription",
    userId: sub.userId,
    userName: sub.user?.name ?? null,
    userEmail: sub.user?.email ?? null,
    userRole: sub.user?.role ?? "SUBSCRIBER",
    plan: sub.plan,
    planLabel: planConfig.label,
    status: sub.status,
    churnState: resolveChurnState(sub),
    cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
    periodEnd: sub.currentPeriodEnd?.toISOString?.() ?? sub.trialEndsAt?.toISOString?.() ?? null,
    lastPaymentAt: sub.lastPaymentAt?.toISOString?.() ?? null,
    lastPaymentError: sub.lastPaymentError ?? null,
    updatedAt: sub.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function mapCompanySubscription(sub: any): ChurnSubscriptionRow {
  const planConfig = getCompanyPlanConfig(sub.plan);
  const companyLabel = COMPANY_TYPE_LABELS[sub.companyType] ?? sub.companyType;
  return {
    id: sub.id,
    segment: "company",
    segmentLabel: `Company — ${companyLabel}`,
    userId: sub.userId,
    userName: sub.user?.name ?? null,
    userEmail: sub.user?.email ?? null,
    userRole: sub.user?.role ?? null,
    plan: sub.plan,
    planLabel: planConfig.label,
    status: sub.status,
    churnState: resolveChurnState(sub),
    cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
    periodEnd: sub.currentPeriodEnd?.toISOString?.() ?? null,
    lastPaymentAt: sub.lastPaymentAt?.toISOString?.() ?? null,
    lastPaymentError: sub.lastPaymentError ?? null,
    updatedAt: sub.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function mapCreatorLicense(license: any): ChurnSubscriptionRow {
  return {
    id: license.id,
    segment: "creator",
    segmentLabel: "Creator distribution licence",
    userId: license.userId,
    userName: license.user?.name ?? null,
    userEmail: license.user?.email ?? null,
    userRole: license.user?.role ?? null,
    plan: license.type,
    planLabel: formatCreatorLicenseSummary(license.type),
    status: license.status,
    churnState: resolveChurnState(license),
    cancelAtPeriodEnd: Boolean(license.cancelAtPeriodEnd),
    periodEnd: license.yearlyExpiresAt?.toISOString?.() ?? null,
    lastPaymentAt: license.lastPaymentAt?.toISOString?.() ?? null,
    lastPaymentError: license.lastPaymentError ?? null,
    updatedAt: license.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

const subscriptionChurnWhere = {
  OR: [{ status: "CANCELLED" }, { cancelAtPeriodEnd: true }, { status: "PAST_DUE" }],
};

export async function getAdminChurnTelemetry(limit = 120): Promise<{
  metrics: AdminChurnMetrics;
  cancelledSubscriptions: ChurnSubscriptionRow[];
  cancelledTransactions: ChurnTransactionRow[];
}> {
  const [
    viewerSubs,
    companySubs,
    creatorLicenses,
    gatewayCancelled,
    gatewayFailed,
    marketplaceFailed,
    viewerPaymentFailed,
    metricsRows,
  ] = await Promise.all([
    db.viewerSubscription.findMany({
      where: { viewerModel: "SUBSCRIPTION", ...subscriptionChurnWhere },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.companySubscription.findMany({
      where: subscriptionChurnWhere,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.creatorDistributionLicense.findMany({
      where: subscriptionChurnWhere,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.paymentRecord.findMany({
      where: { status: "CANCELLED" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.paymentRecord.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    db.transaction.findMany({
      where: { status: { in: ["FAILED", "REFUNDED"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        payer: { select: { id: true, name: true, email: true, role: true } },
        payee: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    db.subscriptionPayment.findMany({
      where: { status: { in: ["FAILED", "REFUNDED"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        viewerSubscription: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    }),
    Promise.all([
      db.viewerSubscription.count({ where: { viewerModel: "SUBSCRIPTION", status: "CANCELLED" } }),
      db.viewerSubscription.count({
        where: { viewerModel: "SUBSCRIPTION", cancelAtPeriodEnd: true, status: { not: "CANCELLED" } },
      }),
      db.viewerSubscription.count({ where: { viewerModel: "SUBSCRIPTION", status: "PAST_DUE" } }),
      db.companySubscription.count({ where: { status: "CANCELLED" } }),
      db.companySubscription.count({
        where: { cancelAtPeriodEnd: true, status: { not: "CANCELLED" } },
      }),
      db.creatorDistributionLicense.count({ where: { status: "CANCELLED" } }),
      db.creatorDistributionLicense.count({
        where: { cancelAtPeriodEnd: true, status: { not: "CANCELLED" } },
      }),
      db.paymentRecord.count({ where: { status: "CANCELLED" } }),
      db.paymentRecord.count({ where: { status: "FAILED" } }),
      db.transaction.count({ where: { status: { in: ["FAILED", "REFUNDED"] } } }),
      db.subscriptionPayment.count({ where: { status: { in: ["FAILED", "REFUNDED"] } } }),
    ]),
  ]);

  const [
    viewerCancelled,
    viewerScheduledCancel,
    viewerPastDue,
    companyCancelled,
    companyScheduledCancel,
    creatorCancelled,
    creatorScheduledCancel,
    gatewayPaymentsCancelled,
    gatewayPaymentsFailed,
    marketplaceTransactionsFailed,
    viewerRenewalPaymentsFailed,
  ] = metricsRows as number[];

  const cancelledSubscriptions = [
    ...viewerSubs.map(mapViewerSubscription),
    ...companySubs.map(mapCompanySubscription),
    ...creatorLicenses.map(mapCreatorLicense),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const cancelledTransactions: ChurnTransactionRow[] = [
    ...gatewayCancelled.map((p: any) => ({
      id: p.id,
      source: "gateway_payment" as const,
      status: p.status,
      amount: Number(p.amount ?? 0),
      purpose: p.purpose ?? null,
      purposeLabel: PAYMENT_PURPOSE_LABELS[p.purpose] ?? p.purpose ?? null,
      userId: p.userId ?? null,
      userName: p.user?.name ?? null,
      userEmail: p.user?.email ?? null,
      userRole: p.user?.role ?? null,
      counterpartyName: null,
      counterpartyRole: null,
      createdAt: p.createdAt?.toISOString?.() ?? new Date().toISOString(),
      failedAt: p.failedAt?.toISOString?.() ?? null,
      failureReason: p.failureReason ?? p.providerItnStatus ?? null,
    })),
    ...gatewayFailed.map((p: any) => ({
      id: p.id,
      source: "gateway_payment" as const,
      status: p.status,
      amount: Number(p.amount ?? 0),
      purpose: p.purpose ?? null,
      purposeLabel: PAYMENT_PURPOSE_LABELS[p.purpose] ?? p.purpose ?? null,
      userId: p.userId ?? null,
      userName: p.user?.name ?? null,
      userEmail: p.user?.email ?? null,
      userRole: p.user?.role ?? null,
      counterpartyName: null,
      counterpartyRole: null,
      createdAt: p.createdAt?.toISOString?.() ?? new Date().toISOString(),
      failedAt: p.failedAt?.toISOString?.() ?? null,
      failureReason: p.failureReason ?? p.providerItnStatus ?? null,
    })),
    ...marketplaceFailed.map((t: any) => ({
      id: t.id,
      source: "marketplace" as const,
      status: t.status,
      amount: Number(t.totalAmount ?? t.amount ?? 0),
      purpose: t.type ?? null,
      purposeLabel: t.type?.replace(/_/g, " ") ?? null,
      userId: t.payerId ?? null,
      userName: t.payer?.name ?? null,
      userEmail: t.payer?.email ?? null,
      userRole: t.payer?.role ?? null,
      counterpartyName: t.payee?.name ?? null,
      counterpartyRole: t.payee?.role ?? null,
      createdAt: t.createdAt?.toISOString?.() ?? new Date().toISOString(),
      failedAt: null,
      failureReason: null,
    })),
    ...viewerPaymentFailed.map((p: any) => ({
      id: p.id,
      source: "viewer_subscription_payment" as const,
      status: p.status,
      amount: Number(p.amount ?? 0),
      purpose: p.purpose ?? "viewer_subscription_renewal",
      purposeLabel: PAYMENT_PURPOSE_LABELS[p.purpose ?? ""] ?? "Viewer subscription payment",
      userId: p.viewerSubscription?.userId ?? null,
      userName: p.viewerSubscription?.user?.name ?? null,
      userEmail: p.viewerSubscription?.user?.email ?? null,
      userRole: p.viewerSubscription?.user?.role ?? "SUBSCRIBER",
      counterpartyName: null,
      counterpartyRole: null,
      createdAt: p.createdAt?.toISOString?.() ?? new Date().toISOString(),
      failedAt: null,
      failureReason: p.failureReason ?? null,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const metrics: AdminChurnMetrics = {
    subscriptionsCancelled: viewerCancelled + companyCancelled + creatorCancelled,
    subscriptionsScheduledCancel: viewerScheduledCancel + companyScheduledCancel + creatorScheduledCancel,
    subscriptionsPastDue: viewerPastDue,
    viewerCancelled,
    viewerScheduledCancel,
    companyCancelled,
    companyScheduledCancel,
    creatorCancelled,
    creatorScheduledCancel,
    gatewayPaymentsCancelled,
    gatewayPaymentsFailed,
    marketplaceTransactionsFailed,
    viewerRenewalPaymentsFailed,
  };

  return { metrics, cancelledSubscriptions, cancelledTransactions };
}
