import { prisma } from "@/lib/prisma";
import { SIGNED_CONTRACT_STATUSES } from "@/lib/contract-template-engine";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";
import { resolveContractHireAmount } from "@/lib/payments/contract-hire-amount";
import { estimatePayFastFee } from "@/lib/payments/payfast-settlement";
import { postMarketplacePaymentAllocation } from "@/lib/payments/marketplace-allocation";
import { settleMarketplaceWithWallet } from "@/lib/payments/marketplace-wallet";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { createProductionExpense } from "@/lib/expense-service";
import { logContractEvent } from "@/lib/contract-lifecycle";
import { syncContractHireReceiptSnapshots } from "@/lib/payments/contract-hire-receipt";

export const CONTRACT_HIRE_TRANSACTION_TYPE = {
  ACTOR: "CONTRACT_HIRE_CAST",
  CREW: "CONTRACT_HIRE_CREW",
} as const;

export type ContractHireSettlementQuote = {
  contractId: string;
  projectId: string;
  projectTitle: string;
  payerUserId: string;
  payeeUserId: string;
  payeeLabel: string;
  contractType: "ACTOR" | "CREW";
  baseAmount: number;
  platformFeeAmount: number;
  gatewayFeeEstimate: number;
  totalAmount: number;
  transactionType: string;
  purpose: string;
  escrowIdempotencyKey: string;
};

const PAYABLE_TYPES = new Set(["ACTOR", "CREW"]);

export async function resolveContractHireSettlement(
  contractId: string,
  projectId: string,
  payerUserId: string,
): Promise<{ ok: true; quote: ContractHireSettlementQuote } | { ok: false; error: string; status: number }> {
  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      project: { select: { id: true, title: true } },
      versions: { orderBy: { version: "desc" }, take: 1, select: { terms: true } },
      castingTalent: {
        select: {
          id: true,
          name: true,
          dailyRate: true,
          castingAgency: { select: { id: true, agencyName: true, userId: true } },
        },
      },
      crewTeam: { select: { id: true, companyName: true, userId: true } },
      counterpartyUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!contract) return { ok: false, error: "Contract not found", status: 404 };
  if (!PAYABLE_TYPES.has(contract.type)) {
    return { ok: false, error: "Only cast and crew contracts support salary payment", status: 400 };
  }
  if (!SIGNED_CONTRACT_STATUSES.has(contract.status)) {
    return { ok: false, error: "Contract must be fully signed before salary payment", status: 400 };
  }
  if (contract.paymentTransactionId) {
    return { ok: false, error: "Contract salary already paid", status: 400 };
  }

  const payeeUserId =
    contract.counterpartyUserId ??
    (contract.type === "ACTOR"
      ? contract.castingTalent?.castingAgency?.userId ?? null
      : contract.crewTeam?.userId ?? null);

  if (!payeeUserId) {
    return {
      ok: false,
      error: "No payee account linked to this contract. Set a counterparty or link talent/crew with a Story Time account.",
      status: 400,
    };
  }
  if (payeeUserId === payerUserId) {
    return { ok: false, error: "Payee cannot be the same as payer", status: 400 };
  }

  const baseAmount = await resolveContractHireAmount({
    projectId,
    contractType: contract.type,
    hireAmount: contract.hireAmount,
    talentName: contract.castingTalent?.name,
    crewLabel: contract.crewTeam?.companyName ?? contract.recipientLabel,
    talentDailyRate: contract.castingTalent?.dailyRate,
    terms: contract.versions[0]?.terms,
  });

  if (baseAmount <= 0) {
    return {
      ok: false,
      error: "Could not determine contract salary amount. Set hire amount on the contract or budget line.",
      status: 400,
    };
  }

  const platformFeeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + platformFeeAmount) * 100) / 100;
  const gatewayFeeEstimate = estimatePayFastFee(totalAmount, "cc");

  const payeeLabel =
    contract.recipientLabel?.trim() ||
    contract.castingTalent?.name ||
    contract.crewTeam?.companyName ||
    contract.counterpartyUser?.name ||
    "Payee";

  const contractType = contract.type as "ACTOR" | "CREW";
  const purpose = contractType === "ACTOR" ? "CONTRACT_HIRE_CAST" : "CONTRACT_HIRE_CREW";

  return {
    ok: true,
    quote: {
      contractId,
      projectId,
      projectTitle: contract.project.title,
      payerUserId,
      payeeUserId,
      payeeLabel,
      contractType,
      baseAmount,
      platformFeeAmount,
      gatewayFeeEstimate,
      totalAmount,
      transactionType: CONTRACT_HIRE_TRANSACTION_TYPE[contractType],
      purpose,
      escrowIdempotencyKey: `escrow_hold_contract_hire_${contractId}`,
    },
  };
}

async function syncContractHireExpense(quote: ContractHireSettlementQuote, transactionId: string) {
  const category = quote.contractType === "ACTOR" ? "CAST" : "CREW";
  const autoKey = `contract_hire:${quote.contractId}`;

  await createProductionExpense({
    projectId: quote.projectId,
    userId: quote.payerUserId,
    amount: quote.baseAmount,
    title: `Salary — ${quote.payeeLabel}`,
    category,
    vendor: quote.payeeLabel,
    department: category,
    paymentMethod: "TRANSFER",
    paymentStatus: "PAID",
    approvalStatus: "APPROVED",
    notes: `Contract hire payment · ${quote.contractId} · txn ${transactionId}`,
    linkedContractId: quote.contractId,
    linkedMarketplaceTransactionId: transactionId,
    autoGeneratedFrom: autoKey,
    skipDuplicateCheck: true,
    forceCreate: true,
  });
}

async function markContractPaid(quote: ContractHireSettlementQuote, transactionId: string, paymentRecordId?: string) {
  await prisma.projectContract.update({
    where: { id: quote.contractId },
    data: {
      paymentTransactionId: transactionId,
      hireAmount: quote.baseAmount,
      paidAt: new Date(),
    },
  });

  await logContractEvent(quote.contractId, "PAYMENT_SETTLED", {
    userId: quote.payerUserId,
    detail: `Salary ${quote.baseAmount.toFixed(2)} ZAR paid to ${quote.payeeLabel}`,
    metadata: { transactionId, paymentRecordId: paymentRecordId ?? null },
  }).catch(() => {});

  await syncContractHireExpense(quote, transactionId).catch(() => {});
  await syncContractHireReceiptSnapshots(quote, transactionId, paymentRecordId).catch(() => {});

  await prisma.notification.create({
    data: {
      userId: quote.payeeUserId,
      type: "PAYMENT_RECEIVED",
      title: "Contract salary received",
      body: `${quote.projectTitle}: ${quote.baseAmount.toFixed(2)} ZAR is in your Story Time wallet (pending payout).`,
      metadata: JSON.stringify({
        url: quote.contractType === "CREW" ? "/crew-team/wallet" : "/casting-agency/wallet",
        contractId: quote.contractId,
        transactionId,
      }),
    },
  }).catch(() => {});

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        type: "SYSTEM_RELEASE",
        title: "Contract hire payment settled",
        body: `${quote.projectTitle} · ${quote.payeeLabel} · R${quote.baseAmount.toFixed(2)}`,
        metadata: JSON.stringify({
          url: "/admin/payments",
          contractId: quote.contractId,
          transactionId,
        }),
      },
    }).catch(() => {});
  }
}

export async function finalizeContractHireWalletPayment(quote: ContractHireSettlementQuote) {
  const walletSettle = await settleMarketplaceWithWallet({
    buyerUserId: quote.payerUserId,
    sellerUserId: quote.payeeUserId,
    baseAmount: quote.baseAmount,
    feeAmount: quote.platformFeeAmount,
    totalAmount: quote.totalAmount,
    referenceType: "ProjectContract",
    referenceId: quote.contractId,
    escrowIdempotencyKey: quote.escrowIdempotencyKey,
  });
  if (!walletSettle.ok) {
    return { ok: false as const, error: walletSettle.error };
  }

  const tx = await prisma.transaction.create({
    data: {
      payerId: quote.payerUserId,
      payeeId: quote.payeeUserId,
      amount: quote.baseAmount,
      feeAmount: quote.platformFeeAmount,
      totalAmount: quote.totalAmount,
      status: "COMPLETED",
      type: quote.transactionType,
      referenceId: quote.contractId,
      externalPaymentId: null,
    },
  });

  const buyerWallet = await ensureWalletForUser(quote.payerUserId);
  const sellerWallet = await ensureWalletForUser(quote.payeeUserId);
  await (prisma as { escrowAccount: { upsert: (args: unknown) => Promise<unknown> } }).escrowAccount.upsert({
    where: {
      referenceType_referenceId: {
        referenceType: "ProjectContract",
        referenceId: quote.contractId,
      },
    },
    create: {
      referenceType: "ProjectContract",
      referenceId: quote.contractId,
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

  await markContractPaid(quote, tx.id);

  return {
    ok: true as const,
    transactionId: tx.id,
    paymentMode: "wallet" as const,
    baseAmount: quote.baseAmount,
    platformFeeAmount: quote.platformFeeAmount,
    totalAmount: quote.totalAmount,
  };
}

export async function finalizeContractHireGatewayPayment(paymentRecordId: string, quote: ContractHireSettlementQuote) {
  await postMarketplacePaymentAllocation({
    payerUserId: quote.payerUserId,
    sellerUserId: quote.payeeUserId,
    baseAmount: quote.baseAmount,
    feeAmount: quote.platformFeeAmount,
    totalAmount: quote.totalAmount,
    referenceType: "ProjectContract",
    referenceId: quote.contractId,
    idempotencyKey: `gateway_contract_hire_${paymentRecordId}`,
    paymentSource: "gateway",
    paymentRecordId,
  });

  const buyerWallet = await ensureWalletForUser(quote.payerUserId);
  const sellerWallet = await ensureWalletForUser(quote.payeeUserId);
  await (prisma as { escrowAccount: { upsert: (args: unknown) => Promise<unknown> } }).escrowAccount.upsert({
    where: {
      referenceType_referenceId: {
        referenceType: "ProjectContract",
        referenceId: quote.contractId,
      },
    },
    create: {
      referenceType: "ProjectContract",
      referenceId: quote.contractId,
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

  const tx = await prisma.transaction.create({
    data: {
      payerId: quote.payerUserId,
      payeeId: quote.payeeUserId,
      amount: quote.baseAmount,
      feeAmount: quote.platformFeeAmount,
      totalAmount: quote.totalAmount,
      status: "COMPLETED",
      type: quote.transactionType,
      referenceId: quote.contractId,
      externalPaymentId: paymentRecordId,
    },
  });

  await markContractPaid(quote, tx.id, paymentRecordId);

  return {
    ok: true as const,
    transactionId: tx.id,
    paymentMode: "gateway" as const,
  };
}
