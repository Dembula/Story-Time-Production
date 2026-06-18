import "server-only";

import { prisma } from "@/lib/prisma";
import { splitViewerRevenue } from "@/lib/payments/fees";
import {
  getPaymentSettlementAmount,
  payFastMethodLabel,
} from "@/lib/payments/payfast-settlement";
import {
  MARKETPLACE_TX_FEE_RATE,
  STORYTIME_TRANSACTION_FEE_LABEL,
  VIEWER_CREATOR_SPLIT,
  VIEWER_PLATFORM_SPLIT,
} from "@/lib/payments/config";
import { MARKETPLACE_TRANSACTION_TYPE } from "@/lib/financial-ledger";

const db = prisma as any;

const VIEWER_POOL_PURPOSES = new Set([
  "viewer_subscription",
  "viewer_subscription_renewal",
  "viewer_ppv",
]);

const MARKETPLACE_ENTITY_TYPES = new Set([
  "EquipmentRequest",
  "LocationBooking",
  "CateringBooking",
  "CrewTeamRequest",
  "CastingInquiry",
]);

export const PAYMENT_PURPOSE_LABELS: Record<string, string> = {
  viewer_subscription: "Viewer subscription (initial)",
  viewer_subscription_renewal: "Viewer subscription renewal",
  viewer_ppv: "Viewer pay-per-view title",
  SCRIPT_REVIEW: "Executive script review",
  CASTING_ACQUISITION_FEE: "Casting acquisition fee",
  AUDITION_LISTING: "Audition role listing",
  COMPANY_SUBSCRIPTION: "Company listing subscription",
  COMPANY_SUBSCRIPTION_RENEWAL: "Company subscription renewal",
  CREATOR_YEARLY_LICENSE: "Creator yearly licence",
  CREATOR_CONTENT_UPLOAD: "Creator catalogue upload",
  CREATOR_MUSIC_UPLOAD: "Creator music upload",
  creator_film_upload: "Creator per-film upload",
  creator_pipeline_yearly: "Creator pipeline (yearly)",
  creator_pipeline_monthly: "Creator pipeline (monthly)",
  creator_pipeline_monthly_renewal: "Creator pipeline monthly renewal",
  creator_pipeline_yearly_renewal: "Creator pipeline yearly renewal",
  creator_upload_only_yearly_renewal: "Creator upload-only yearly renewal",
  creator_upload_only_yearly: "Creator upload-only yearly",
  creator_distribution_yearly: "Creator distribution (yearly)",
  creator_distribution_per_upload: "Creator distribution per upload",
  music_track_publish: "Music track publish",
  EQUIPMENT_REQUEST: "Marketplace — equipment hire",
  LOCATION_BOOKING: "Marketplace — location booking",
  CATERING_BOOKING: "Marketplace — catering booking",
  CREW_REQUEST: "Marketplace — crew team request",
  CAST_INQUIRY: "Marketplace — casting inquiry",
};

export type RevenueRouteLine = {
  label: string;
  recipient: string;
  recipientRole?: string;
  accountType: string;
  amount: number;
  description: string;
};

export type AdminPaymentRecordDetail = {
  kind: "payment_record";
  id: string;
  status: string;
  purpose: string;
  purposeLabel: string;
  amount: number;
  settlementAmount: number | null;
  providerFeeAmount: number | null;
  providerPaymentMethod: string | null;
  providerPaymentMethodLabel: string | null;
  settlementSource: string | null;
  currency: string;
  provider: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  gatewayReference: string | null;
  providerPaymentId: string | null;
  providerItnStatus: string | null;
  payer: { id: string; name: string | null; email: string | null; role: string | null } | null;
  relatedEntity: { type: string | null; id: string | null; summary: string | null; extra?: Record<string, unknown> };
  revenueCategory: string;
  revenueRouting: RevenueRouteLine[];
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    subtotalAmount: number;
    platformFeeAmount: number;
    totalAmount: number;
    lines: { description: string; quantity: number; unitAmount: number; totalAmount: number }[];
  } | null;
  gatewayReferences: {
    id: string;
    externalRef: string;
    referenceType: string;
    referenceId: string;
    createdAt: string;
  }[];
  webhookEvents: {
    id: string;
    eventType: string;
    eventId: string | null;
    signatureVerified: boolean;
    processingError: string | null;
    processedAt: string | null;
    createdAt: string;
  }[];
  gatewayEvents: {
    id: string;
    eventType: string;
    eventId: string | null;
    signatureVerified: boolean;
    processed: boolean;
    createdAt: string;
  }[];
  ledgerBatch: {
    id: string;
    idempotencyKey: string;
    status: string;
    entries: {
      direction: string;
      accountType: string;
      transactionType: string;
      amount: number;
      description: string | null;
      userId: string;
      userLabel: string;
    }[];
  } | null;
  metadata: Record<string, unknown> | null;
  subscriptionPayment: {
    id: string;
    amount: number;
    status: string;
    purpose: string;
    paidAt: string | null;
  } | null;
};

export type AdminMarketplaceTransactionDetail = {
  kind: "marketplace_transaction";
  id: string;
  status: string;
  type: string;
  typeLabel: string;
  referenceId: string;
  amount: number;
  feeAmount: number;
  totalAmount: number;
  feeRateLabel: string;
  createdAt: string;
  gatewayReference: string | null;
  externalPaymentId: string | null;
  payer: { id: string; name: string | null; email: string | null; role: string | null };
  payee: { id: string; name: string | null; email: string | null; role: string | null };
  referenceEntity: { summary: string | null; extra?: Record<string, unknown> };
  revenueRouting: RevenueRouteLine[];
  paymentRecord: {
    id: string;
    status: string;
    purpose: string;
    amount: number;
    provider: string;
    paidAt: string | null;
  } | null;
  escrow: {
    id: string;
    status: string;
    amount: number;
    releaseTrigger: string | null;
    releasedAt: string | null;
  } | null;
};

function purposeLabel(purpose: string): string {
  return PAYMENT_PURPOSE_LABELS[purpose] ?? purpose.replace(/_/g, " ");
}

function userLabel(user: { name?: string | null; email?: string | null; id: string }) {
  return user.name?.trim() || user.email?.trim() || user.id;
}

function buildRevenueRoutingForPayment(
  purpose: string,
  grossAmount: number,
  settlementAmount: number,
  providerFeeAmount: number | null,
  providerPaymentMethodLabel: string | null,
  relatedEntityType: string | null,
): {
  category: string;
  lines: RevenueRouteLine[];
} {
  const payfastFee = providerFeeAmount ?? Math.max(0, grossAmount - settlementAmount);
  const payfastFeeLines: RevenueRouteLine[] =
    payfastFee > 0.001
      ? [
          {
            label: "Customer charged (gross)",
            recipient: "PayFast checkout",
            recipientRole: "Buyer payment",
            accountType: "—",
            amount: grossAmount,
            description: "Amount the customer paid at checkout",
          },
          {
            label: "PayFast processing fee",
            recipient: "PayFast",
            recipientRole: providerPaymentMethodLabel ?? "Gateway",
            accountType: "—",
            amount: payfastFee,
            description: providerPaymentMethodLabel
              ? `${providerPaymentMethodLabel} fee (incl. VAT) deducted before settlement`
              : "Gateway fee deducted before settlement",
          },
          {
            label: "Net treasury inflow",
            recipient: "Story Time treasury",
            recipientRole: "Platform",
            accountType: "AVAILABLE",
            amount: settlementAmount,
            description: "Actual amount credited after PayFast fees",
          },
        ]
      : [];

  if (relatedEntityType && MARKETPLACE_ENTITY_TYPES.has(relatedEntityType)) {
    const base = grossAmount / (1 + MARKETPLACE_TX_FEE_RATE);
    const fee = Math.round((grossAmount - base) * 100) / 100;
    const vendorNet = Math.round(base * 100) / 100;
    return {
      category: "Marketplace (3% Story Time fee)",
      lines: [
        ...payfastFeeLines,
        {
          label: "Vendor earnings (pending monthly payout)",
          recipient: "Marketplace vendor wallet",
          recipientRole: "Payee",
          accountType: "PENDING",
          amount: vendorNet,
          description: "Held as PENDING until monthly vendor release cron",
        },
        {
          label: STORYTIME_TRANSACTION_FEE_LABEL,
          recipient: "Story Time",
          recipientRole: "Platform",
          accountType: "PLATFORM_REVENUE",
          amount: fee,
          description: `${Math.round(MARKETPLACE_TX_FEE_RATE * 100)}% marketplace fee on service base`,
        },
      ],
    };
  }

  if (VIEWER_POOL_PURPOSES.has(purpose)) {
    const split = splitViewerRevenue(settlementAmount);
    const poolName = purpose === "viewer_ppv" ? "Viewer PPV pool" : "Viewer subscription pool";
    return {
      category: `${poolName} — split on net after PayFast fees`,
      lines: [
        ...payfastFeeLines,
        {
          label: `Creator pool (${Math.round(VIEWER_CREATOR_SPLIT * 100)}% of net)`,
          recipient: "Story Time creator pool",
          recipientRole: "Creators (watch-time distribution)",
          accountType: "CREATOR_REVENUE",
          amount: split.creator,
          description: "Distributed monthly by watch-time proportion",
        },
        {
          label: `Story Time share (${Math.round(VIEWER_PLATFORM_SPLIT * 100)}% of net)`,
          recipient: "Story Time",
          recipientRole: "Platform",
          accountType: "PLATFORM_REVENUE",
          amount: split.platform,
          description: "Platform operations revenue from viewer subscriptions/PPV",
        },
      ],
    };
  }

  return {
    category: "Platform service revenue (net after PayFast fees)",
    lines: [
      ...payfastFeeLines,
      {
        label: "Recognized platform revenue",
        recipient: "Story Time",
        recipientRole: "Platform",
        accountType: "PLATFORM_REVENUE",
        amount: settlementAmount,
        description: purposeLabel(purpose),
      },
    ],
  };
}

async function resolveRelatedEntitySummary(type: string | null, id: string | null) {
  if (!type || !id) return { summary: null as string | null, extra: undefined as Record<string, unknown> | undefined };

  if (type === "ViewerSubscription") {
    const sub = await db.viewerSubscription.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!sub) return { summary: "Viewer subscription (not found)", extra: undefined };
    return {
      summary: `Viewer ${sub.viewerModel} plan ${sub.plan} — ${sub.user?.email ?? sub.userId}`,
      extra: {
        plan: sub.plan,
        viewerModel: sub.viewerModel,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        trialEndsAt: sub.trialEndsAt,
      },
    };
  }

  if (type === "CompanySubscription") {
    const sub = await db.companySubscription.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
    if (!sub) return { summary: "Company subscription (not found)", extra: undefined };
    return {
      summary: `${sub.companyType} listing — ${sub.user?.email ?? sub.userId}`,
      extra: { companyType: sub.companyType, plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd },
    };
  }

  if (type === "CreatorDistributionLicense") {
    const lic = await db.creatorDistributionLicense.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!lic) return { summary: "Creator licence (not found)", extra: undefined };
    return {
      summary: `Creator licence ${lic.type} — ${lic.user?.email ?? lic.userId}`,
      extra: { licenseType: lic.type, status: lic.status, yearlyExpiresAt: lic.yearlyExpiresAt },
    };
  }

  if (type === "ViewerContentAccess") {
    const access = await db.viewerContentAccess.findUnique({
      where: { id },
      include: { content: { select: { title: true } }, user: { select: { email: true } } },
    });
    if (!access) return { summary: "PPV access (not found)", extra: undefined };
    return {
      summary: `PPV: ${access.content?.title ?? access.contentId} — ${access.user?.email ?? access.userId}`,
      extra: { contentId: access.contentId, expiresAt: access.expiresAt, accessType: access.accessType },
    };
  }

  if (MARKETPLACE_ENTITY_TYPES.has(type)) {
    return { summary: `${type} ${id}`, extra: { entityType: type, entityId: id } };
  }

  return { summary: `${type} ${id}`, extra: { entityType: type, entityId: id } };
}

async function loadLedgerBatchForPayment(paymentRecordId: string, relatedType: string | null, relatedId: string | null) {
  const idempotencyKey = `gateway_allocate_${paymentRecordId}`;
  let batch = await db.ledgerBatch.findUnique({
    where: { idempotencyKey },
    include: {
      entries: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!batch && relatedType && relatedId) {
    batch = await db.ledgerBatch.findFirst({
      where: { referenceType: relatedType, referenceId: relatedId },
      orderBy: { createdAt: "desc" },
      include: {
        entries: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  if (!batch) return null;

  return {
    id: batch.id,
    idempotencyKey: batch.idempotencyKey,
    status: batch.status,
    entries: (batch.entries ?? []).map((e: any) => ({
      direction: e.direction,
      accountType: e.accountType,
      transactionType: e.transactionType,
      amount: e.amount,
      description: e.description,
      userId: e.userId,
      userLabel: userLabel(e.user ?? { id: e.userId }),
    })),
  };
}

export async function getAdminPaymentRecordDetail(paymentRecordId: string): Promise<AdminPaymentRecordDetail | null> {
  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!payment) return null;

  const metadata =
    payment.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : null;
  const invoiceId = typeof metadata?.invoiceId === "string" ? metadata.invoiceId : null;

  const [related, invoice, gatewayReferences, webhookEvents, gatewayEvents, subscriptionPayment, ledgerBatch] =
    await Promise.all([
      resolveRelatedEntitySummary(payment.relatedEntityType, payment.relatedEntityId),
      invoiceId
        ? db.invoice.findUnique({
            where: { id: invoiceId },
            include: { lines: true },
          })
        : null,
      db.gatewayReference.findMany({
        where: {
          OR: [
            { metadata: { path: ["paymentRecordId"], equals: paymentRecordId } },
            ...(payment.relatedEntityId
              ? [{ referenceType: payment.relatedEntityType, referenceId: payment.relatedEntityId }]
              : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.paymentWebhookEvent.findMany({
        where: { reference: paymentRecordId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.gatewayEvent.findMany({
        where: {
          OR: [
            { eventId: payment.gatewayReference ?? undefined },
            { payload: { path: ["paymentRecordId"], equals: paymentRecordId } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      payment.relatedEntityType === "ViewerSubscription" && payment.relatedEntityId
        ? db.subscriptionPayment.findFirst({
            where: { viewerSubscriptionId: payment.relatedEntityId },
            orderBy: { paidAt: "desc" },
          })
        : null,
      loadLedgerBatchForPayment(paymentRecordId, payment.relatedEntityType, payment.relatedEntityId),
    ]);

  const settlementAmount = getPaymentSettlementAmount({
    amount: Number(payment.amount),
    settlementAmount: payment.settlementAmount,
  });
  const methodLabel = payment.providerPaymentMethod
    ? payFastMethodLabel(payment.providerPaymentMethod)
    : null;

  const routing = buildRevenueRoutingForPayment(
    payment.purpose ?? "",
    Number(payment.amount),
    settlementAmount,
    payment.providerFeeAmount != null ? Number(payment.providerFeeAmount) : null,
    methodLabel,
    payment.relatedEntityType,
  );

  return {
    kind: "payment_record",
    id: payment.id,
    status: payment.status,
    purpose: payment.purpose,
    purposeLabel: purposeLabel(payment.purpose ?? ""),
    amount: Number(payment.amount),
    settlementAmount: payment.settlementAmount != null ? Number(payment.settlementAmount) : null,
    providerFeeAmount: payment.providerFeeAmount != null ? Number(payment.providerFeeAmount) : null,
    providerPaymentMethod: payment.providerPaymentMethod ?? null,
    providerPaymentMethodLabel: methodLabel,
    settlementSource: payment.settlementSource ?? null,
    currency: payment.currency ?? "ZAR",
    provider: payment.provider,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    gatewayReference: payment.gatewayReference ?? null,
    providerPaymentId: payment.providerPaymentId ?? null,
    providerItnStatus: payment.providerItnStatus ?? null,
    payer: payment.user
      ? {
          id: payment.user.id,
          name: payment.user.name,
          email: payment.user.email,
          role: payment.user.role,
        }
      : null,
    relatedEntity: {
      type: payment.relatedEntityType,
      id: payment.relatedEntityId,
      summary: related.summary,
      extra: related.extra,
    },
    revenueCategory: routing.category,
    revenueRouting: routing.lines,
    invoice: invoice
      ? {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          subtotalAmount: invoice.subtotalAmount,
          platformFeeAmount: invoice.platformFeeAmount,
          totalAmount: invoice.totalAmount,
          lines: (invoice.lines ?? []).map((l: any) => ({
            description: l.description,
            quantity: l.quantity,
            unitAmount: l.unitAmount,
            totalAmount: l.totalAmount,
          })),
        }
      : null,
    gatewayReferences: gatewayReferences.map((g: any) => ({
      id: g.id,
      externalRef: g.externalRef,
      referenceType: g.referenceType,
      referenceId: g.referenceId,
      createdAt: g.createdAt.toISOString(),
    })),
    webhookEvents: webhookEvents.map((w: any) => ({
      id: w.id,
      eventType: w.eventType,
      eventId: w.eventId,
      signatureVerified: Boolean(w.signatureVerified),
      processingError: w.processingError ?? null,
      processedAt: w.processedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
    gatewayEvents: gatewayEvents.map((g: any) => ({
      id: g.id,
      eventType: g.eventType,
      eventId: g.eventId,
      signatureVerified: Boolean(g.signatureVerified),
      processed: Boolean(g.processed),
      createdAt: g.createdAt.toISOString(),
    })),
    ledgerBatch,
    metadata,
    subscriptionPayment: subscriptionPayment
      ? {
          id: subscriptionPayment.id,
          amount: subscriptionPayment.amount,
          status: subscriptionPayment.status,
          purpose: subscriptionPayment.purpose,
          paidAt: subscriptionPayment.paidAt?.toISOString() ?? null,
        }
      : null,
  };
}

const TX_TYPE_LABELS: Record<string, string> = {
  [MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING]: "Location booking",
  [MARKETPLACE_TRANSACTION_TYPE.CATERING_BOOKING]: "Catering booking",
  [MARKETPLACE_TRANSACTION_TYPE.EQUIPMENT_REQUEST]: "Equipment request",
  [MARKETPLACE_TRANSACTION_TYPE.CREW_REQUEST]: "Crew team request",
  [MARKETPLACE_TRANSACTION_TYPE.CAST_INQUIRY]: "Casting inquiry",
};

async function resolveMarketplaceReference(type: string, referenceId: string) {
  if (type === MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING) {
    const row = await db.locationBooking.findUnique({
      where: { id: referenceId },
      include: {
        location: { select: { name: true, city: true } },
        requester: { select: { name: true, email: true } },
      },
    });
    if (!row) return { summary: "Location booking (not found)" };
    return {
      summary: `Location: ${row.location?.name ?? "—"} (${row.location?.city ?? "—"})`,
      extra: { startDate: row.startDate, endDate: row.endDate, bookingStatus: row.status },
    };
  }
  if (type === MARKETPLACE_TRANSACTION_TYPE.CATERING_BOOKING) {
    const row = await db.cateringBooking.findUnique({
      where: { id: referenceId },
      include: { company: { select: { companyName: true } } },
    });
    if (!row) return { summary: "Catering booking (not found)" };
    return { summary: `Catering: ${row.company?.companyName ?? referenceId}`, extra: { status: row.status } };
  }
  if (type === MARKETPLACE_TRANSACTION_TYPE.EQUIPMENT_REQUEST) {
    const row = await db.equipmentRequest.findUnique({
      where: { id: referenceId },
      include: { equipment: { select: { description: true } } },
    });
    if (!row) return { summary: "Equipment request (not found)" };
    return { summary: `Equipment: ${row.equipment?.description?.slice(0, 80) ?? referenceId}`, extra: { status: row.status } };
  }
  if (type === MARKETPLACE_TRANSACTION_TYPE.CREW_REQUEST) {
    const row = await db.crewTeamRequest.findUnique({ where: { id: referenceId } });
    if (!row) return { summary: "Crew request (not found)" };
    return { summary: `Crew team request ${referenceId}`, extra: { status: row.status, projectName: row.projectName } };
  }
  if (type === MARKETPLACE_TRANSACTION_TYPE.CAST_INQUIRY) {
    const row = await db.castingInquiry.findUnique({ where: { id: referenceId } });
    if (!row) return { summary: "Casting inquiry (not found)" };
    return { summary: `Casting inquiry ${referenceId}`, extra: { status: row.status } };
  }
  return { summary: `${type} ${referenceId}` };
}

export async function getAdminMarketplaceTransactionDetail(
  transactionId: string,
): Promise<AdminMarketplaceTransactionDetail | null> {
  const tx = await db.transaction.findUnique({
    where: { id: transactionId },
    include: {
      payer: { select: { id: true, name: true, email: true, role: true } },
      payee: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  if (!tx) return null;

  const ref = await resolveMarketplaceReference(tx.type, tx.referenceId);

  const entityTypeMap: Record<string, string> = {
    LOCATION_BOOKING: "LocationBooking",
    CATERING_BOOKING: "CateringBooking",
    EQUIPMENT_REQUEST: "EquipmentRequest",
    CREW_REQUEST: "CrewTeamRequest",
    CAST_INQUIRY: "CastingInquiry",
  };
  const entityType = entityTypeMap[tx.type] ?? tx.type;

  const [paymentRecord, escrow] = await Promise.all([
    db.paymentRecord.findFirst({
      where: { relatedEntityType: entityType, relatedEntityId: tx.referenceId },
      orderBy: { createdAt: "desc" },
    }),
    db.escrowAccount.findUnique({
      where: { referenceType_referenceId: { referenceType: entityType, referenceId: tx.referenceId } },
    }),
  ]);

  const revenueRouting: RevenueRouteLine[] = [
    {
      label: "Total charged to buyer",
      recipient: userLabel(tx.payer),
      recipientRole: tx.payer.role ?? "Buyer",
      accountType: "—",
      amount: tx.totalAmount,
      description: "Amount paid at checkout (base + Story Time fee)",
    },
    {
      label: "Vendor / service provider net",
      recipient: userLabel(tx.payee),
      recipientRole: tx.payee.role ?? "Vendor",
      accountType: "PENDING",
      amount: tx.amount,
      description: "Credited to vendor PENDING wallet; released on monthly payout cron",
    },
    {
      label: STORYTIME_TRANSACTION_FEE_LABEL,
      recipient: "Story Time",
      recipientRole: "Platform",
      accountType: "PLATFORM_REVENUE",
      amount: tx.feeAmount,
      description: `${Math.round(MARKETPLACE_TX_FEE_RATE * 100)}% marketplace fee on base amount`,
    },
  ];

  return {
    kind: "marketplace_transaction",
    id: tx.id,
    status: tx.status,
    type: tx.type,
    typeLabel: TX_TYPE_LABELS[tx.type] ?? tx.type.replace(/_/g, " "),
    referenceId: tx.referenceId,
    amount: tx.amount,
    feeAmount: tx.feeAmount,
    totalAmount: tx.totalAmount,
    feeRateLabel: `${Math.round(MARKETPLACE_TX_FEE_RATE * 100)}%`,
    createdAt: tx.createdAt.toISOString(),
    gatewayReference: tx.gatewayReference ?? null,
    externalPaymentId: tx.externalPaymentId ?? null,
    payer: {
      id: tx.payer.id,
      name: tx.payer.name,
      email: tx.payer.email,
      role: tx.payer.role,
    },
    payee: {
      id: tx.payee.id,
      name: tx.payee.name,
      email: tx.payee.email,
      role: tx.payee.role,
    },
    referenceEntity: { summary: ref.summary, extra: ref.extra },
    revenueRouting,
    paymentRecord: paymentRecord
      ? {
          id: paymentRecord.id,
          status: paymentRecord.status,
          purpose: paymentRecord.purpose,
          amount: paymentRecord.amount,
          provider: paymentRecord.provider,
          paidAt: paymentRecord.paidAt?.toISOString() ?? null,
        }
      : null,
    escrow: escrow
      ? {
          id: escrow.id,
          status: escrow.status,
          amount: escrow.amount,
          releaseTrigger: escrow.releaseTrigger,
          releasedAt: escrow.releasedAt?.toISOString() ?? null,
        }
      : null,
  };
}
