import { prisma } from "@/lib/prisma";
import { computeMarketplaceFeeZar, SYNC_DEAL_STATUS_PAID } from "@/lib/financial-ledger";
import { postMarketplacePaymentAllocation } from "@/lib/payments/marketplace-allocation";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { notifyUser } from "@/lib/notify-user";

export const DEFAULT_SYNC_LICENSE_BASE_ZAR = 1500;

export type SyncLicensingQuote = {
  entityType: "SyncRequest";
  entityId: string;
  buyerUserId: string;
  sellerUserId: string;
  musicTrackId: string;
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
  purpose: string;
};

export async function resolveSyncLicensingSettlement(
  syncRequestId: string,
  buyerUserId: string,
): Promise<{ ok: true; quote: SyncLicensingQuote } | { ok: false; error: string; status: number }> {
  const row = await prisma.syncRequest.findUnique({
    where: { id: syncRequestId, requesterId: buyerUserId },
    include: { track: { select: { id: true, creatorId: true } } },
  });
  if (!row) return { ok: false, error: "Sync request not found", status: 404 };
  if (row.status === "PAID") return { ok: false, error: "Already paid", status: 400 };
  if (row.status !== "APPROVED") {
    return { ok: false, error: "Sync request must be approved before payment", status: 400 };
  }

  const baseAmount = row.budget && row.budget > 0 ? row.budget : DEFAULT_SYNC_LICENSE_BASE_ZAR;
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;

  return {
    ok: true,
    quote: {
      entityType: "SyncRequest",
      entityId: syncRequestId,
      buyerUserId,
      sellerUserId: row.musicCreatorId,
      musicTrackId: row.track.id,
      baseAmount,
      feeAmount,
      totalAmount,
      purpose: "SYNC_LICENSING",
    },
  };
}

async function upsertSyncDeal(args: {
  musicTrackId: string;
  requesterId: string;
  amount: number;
  projectName?: string | null;
}) {
  const trimmedProject = args.projectName?.trim();
  const content =
    (trimmedProject
      ? await prisma.content.findFirst({
          where: {
            creatorId: args.requesterId,
            linkedProject: { title: { equals: trimmedProject, mode: "insensitive" } },
          },
          select: { id: true },
        })
      : null) ??
    (await prisma.content.findFirst({
      where: { creatorId: args.requesterId, published: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    })) ??
    (await prisma.content.findFirst({
      where: { creatorId: args.requesterId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }));

  if (!content) {
    if (args.projectName?.trim()) {
      const draft = await prisma.content.create({
        data: {
          title: args.projectName.trim(),
          type: "Film",
          creatorId: args.requesterId,
          published: false,
          reviewStatus: "DRAFT",
        },
        select: { id: true },
      });
      return prisma.syncDeal.create({
        data: {
          contentId: draft.id,
          musicTrackId: args.musicTrackId,
          amount: args.amount,
          status: SYNC_DEAL_STATUS_PAID,
        },
      });
    }
    return null;
  }

  return prisma.syncDeal.upsert({
    where: {
      contentId_musicTrackId: {
        contentId: content.id,
        musicTrackId: args.musicTrackId,
      },
    },
    create: {
      contentId: content.id,
      musicTrackId: args.musicTrackId,
      amount: args.amount,
      status: SYNC_DEAL_STATUS_PAID,
    },
    update: {
      amount: args.amount,
      status: SYNC_DEAL_STATUS_PAID,
    },
  });
}

async function linkMusicSelectionFromSyncRequest(args: {
  musicTrackId: string;
  requesterId: string;
  projectName?: string | null;
  usageType?: string | null;
}) {
  if (!args.projectName?.trim()) return;
  const project = await prisma.originalProject.findFirst({
    where: {
      title: { equals: args.projectName.trim(), mode: "insensitive" },
      members: { some: { userId: args.requesterId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  if (!project) return;
  const existing = await prisma.musicSelection.findFirst({
    where: { projectId: project.id, trackId: args.musicTrackId },
  });
  if (existing) return;
  await prisma.musicSelection.create({
    data: {
      projectId: project.id,
      trackId: args.musicTrackId,
      usage: args.usageType ?? "Sync licensed",
      notes: "Licensed via Story Time sync payment",
    },
  });
}

export async function finalizeSyncLicensingGatewayPayment(paymentRecordId: string) {
  const record = await prisma.paymentRecord.findUnique({
    where: { id: paymentRecordId },
  });
  if (!record?.userId || record.relatedEntityType !== "SyncRequest" || !record.relatedEntityId) {
    return { ok: false as const, error: "Invalid payment record" };
  }

  const resolved = await resolveSyncLicensingSettlement(record.relatedEntityId, record.userId);
  if (!resolved.ok) {
    if (resolved.error === "Already paid") return { ok: true as const, alreadyPaid: true };
    return { ok: false as const, error: resolved.error };
  }

  const quote = resolved.quote;
  if (Math.abs(record.amount - quote.totalAmount) > 0.02) {
    return { ok: false as const, error: "Payment amount mismatch" };
  }

  await postMarketplacePaymentAllocation({
    payerUserId: quote.buyerUserId,
    sellerUserId: quote.sellerUserId,
    baseAmount: quote.baseAmount,
    feeAmount: quote.feeAmount,
    totalAmount: quote.totalAmount,
    referenceType: quote.entityType,
    referenceId: quote.entityId,
    idempotencyKey: `gateway_sync_${paymentRecordId}`,
    paymentSource: "gateway",
    paymentRecordId,
  });

  const buyerWallet = await ensureWalletForUser(quote.buyerUserId);
  const sellerWallet = await ensureWalletForUser(quote.sellerUserId);
  await prisma.escrowAccount.upsert({
    where: {
      referenceType_referenceId: {
        referenceType: quote.entityType,
        referenceId: quote.entityId,
      },
    },
    create: {
      referenceType: quote.entityType,
      referenceId: quote.entityId,
      buyerWalletId: buyerWallet.id,
      sellerWalletId: sellerWallet.id,
      amount: quote.baseAmount,
      status: "RELEASED",
      releaseTrigger: "MONTHLY_VENDOR_PAYOUT",
      releasedAt: new Date(),
    },
    update: {
      status: "RELEASED",
      amount: quote.baseAmount,
      releasedAt: new Date(),
    },
  });

  await prisma.transaction.create({
    data: {
      payerId: quote.buyerUserId,
      payeeId: quote.sellerUserId,
      amount: quote.baseAmount,
      feeAmount: quote.feeAmount,
      totalAmount: quote.totalAmount,
      status: "COMPLETED",
      type: "SYNC_LICENSING",
      referenceId: quote.entityId,
      externalPaymentId: paymentRecordId,
    },
  });

  const syncRequest = await prisma.syncRequest.findUnique({
    where: { id: quote.entityId },
    include: { track: { select: { title: true } }, requester: { select: { name: true } } },
  });

  await prisma.syncRequest.update({
    where: { id: quote.entityId },
    data: { status: "PAID" },
  });

  await upsertSyncDeal({
    musicTrackId: quote.musicTrackId,
    requesterId: quote.buyerUserId,
    amount: quote.baseAmount,
    projectName: syncRequest?.projectName ?? null,
  });

  if (syncRequest) {
    await linkMusicSelectionFromSyncRequest({
      musicTrackId: quote.musicTrackId,
      requesterId: quote.buyerUserId,
      projectName: syncRequest.projectName,
      usageType: syncRequest.usageType,
    });
    await notifyUser({
      userId: quote.sellerUserId,
      type: "SYNC_DEAL_PAID",
      title: "Sync license paid",
      body: `${syncRequest.requester.name ?? "A creator"} paid R${quote.baseAmount.toLocaleString()} to license "${syncRequest.track.title}".`,
      metadata: { url: "/music-creator/revenue", requestId: quote.entityId },
    });
  }

  return { ok: true as const };
}
