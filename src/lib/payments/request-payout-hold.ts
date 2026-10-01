import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { assertFunderVerificationApproved } from "@/lib/funder-verification";
import { assertPayoutKycApproved, requiresPayoutKyc } from "@/lib/payout-kyc";
import { resolvePayoutBankingForUser } from "@/lib/payments/payout-banking";
import { notifyPayoutRequested } from "@/lib/payments/payout-notifications";

const db = prisma as any;

export type RequestPayoutHoldInput = {
  userId: string;
  role?: string | null;
  /** When omitted, uses full available balance. */
  amount?: number;
  requestSource?: "manual" | "auto_cycle";
  /** Skip KYC / banking / tracking gates (caller already validated). */
  skipEligibilityChecks?: boolean;
};

export type RequestPayoutHoldResult =
  | {
      ok: true;
      payoutRequest: { id: string; amount: number; status: string; requestSource?: string };
      amount: number;
    }
  | {
      ok: false;
      code:
        | "REVENUE_TRACKING_PAUSED"
        | "PAYOUT_KYC_REQUIRED"
        | "FUNDER_VERIFICATION_REQUIRED"
        | "PAYOUT_BANKING_REQUIRED"
        | "INSUFFICIENT_BALANCE"
        | "INVALID_AMOUNT"
        | "OPEN_REQUEST_EXISTS"
        | "VIEWER_FORBIDDEN"
        | "LEDGER_HOLD_FAILED";
      error: string;
    };

async function loadUserRole(userId: string, roleHint?: string | null): Promise<string | null> {
  if (roleHint) return roleHint;
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}

/**
 * Shared payout request + AVAILABLE→PENDING hold used by manual API and auto-cycle distribution.
 */
export async function requestPayoutHold(input: RequestPayoutHoldInput): Promise<RequestPayoutHoldResult> {
  const role = await loadUserRole(input.userId, input.role);
  if (role === "SUBSCRIBER") {
    return { ok: false, code: "VIEWER_FORBIDDEN", error: "Viewers cannot request payouts." };
  }

  if (!input.skipEligibilityChecks) {
    if (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR") {
      const { isCreatorRevenueTrackingEnabled } = await import("@/lib/finance/revenue-connector");
      if (!(await isCreatorRevenueTrackingEnabled())) {
        return {
          ok: false,
          code: "REVENUE_TRACKING_PAUSED",
          error: "Creator payouts are paused while platform revenue tracking is offline.",
        };
      }
    }

    if (role === "FUNDER") {
      const funderCheck = await assertFunderVerificationApproved(input.userId);
      if (!funderCheck.ok) {
        return {
          ok: false,
          code: "FUNDER_VERIFICATION_REQUIRED",
          error: funderCheck.error,
        };
      }
    } else if (requiresPayoutKyc(role)) {
      const kycCheck = await assertPayoutKycApproved(input.userId);
      if (!kycCheck.ok) {
        return {
          ok: false,
          code: "PAYOUT_KYC_REQUIRED",
          error: kycCheck.error,
        };
      }
    }

    const banking = await resolvePayoutBankingForUser(input.userId, role);
    if (!banking) {
      return {
        ok: false,
        code: "PAYOUT_BANKING_REQUIRED",
        error:
          "Add your bank details before requesting a payout. Creators: Account → Banking. Marketplace vendors: complete payout verification with banking info.",
      };
    }
  }

  const open = await db.payoutRequest.findFirst({
    where: {
      userId: input.userId,
      status: { in: ["PENDING_REVIEW", "APPROVED", "PROCESSING"] },
    },
    select: { id: true },
  });
  if (open) {
    return {
      ok: false,
      code: "OPEN_REQUEST_EXISTS",
      error: "An open payout request already exists for this account.",
    };
  }

  await ensureWalletForUser(input.userId);

  const locked = await db.wallet.findUnique({
    where: { userId: input.userId },
    select: { id: true, availableBalance: true },
  });
  const available = Number(locked?.availableBalance ?? 0);
  const amount =
    input.amount != null && Number.isFinite(Number(input.amount))
      ? Number(input.amount)
      : available;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT", error: "Valid amount is required." };
  }
  if (!locked || available < amount) {
    return { ok: false, code: "INSUFFICIENT_BALANCE", error: "Insufficient available balance." };
  }

  const requestSource = input.requestSource === "auto_cycle" ? "auto_cycle" : "manual";

  const payoutRequest = await db.payoutRequest.create({
    data: {
      userId: input.userId,
      walletId: locked.id,
      amount,
      currency: "ZAR",
      provider: "MANUAL",
      providerReference: toGatewaySafeReference("payout", `${input.userId}-${Date.now()}`),
      status: "PENDING_REVIEW",
      requestSource,
      adminNotes: requestSource === "auto_cycle" ? "Requested automatically at cycle end." : null,
    },
  });

  try {
    await postBalancedLedgerBatch({
      idempotencyKey: `payout_request_${payoutRequest.id}`,
      referenceType: "PAYOUT_REQUEST",
      referenceId: payoutRequest.id,
      entries: [
        {
          userId: input.userId,
          direction: "DEBIT",
          accountType: "AVAILABLE",
          transactionType: "withdrawal_hold",
          amount,
          description:
            requestSource === "auto_cycle"
              ? "Auto payout request — funds held pending admin review"
              : "Payout request — funds held pending admin review",
        },
        {
          userId: input.userId,
          direction: "CREDIT",
          accountType: "PENDING",
          transactionType: "withdrawal_hold",
          amount,
          description: "Payout pending manual transfer",
        },
      ],
    });
  } catch (err) {
    await db.payoutRequest
      .update({
        where: { id: payoutRequest.id },
        data: { status: "DECLINED", declineReason: "ledger_hold_failed" },
      })
      .catch(() => {});
    console.error("[requestPayoutHold] ledger hold failed", err);
    return {
      ok: false,
      code: "LEDGER_HOLD_FAILED",
      error: "Could not hold funds for payout request.",
    };
  }

  const requester = await db.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true },
  });

  await notifyPayoutRequested({
    payoutId: payoutRequest.id,
    userId: input.userId,
    userName: requester?.name ?? null,
    userEmail: requester?.email ?? null,
    amount,
  }).catch(() => {});

  return {
    ok: true,
    payoutRequest: {
      id: payoutRequest.id,
      amount: payoutRequest.amount,
      status: payoutRequest.status,
      requestSource: payoutRequest.requestSource,
    },
    amount,
  };
}
