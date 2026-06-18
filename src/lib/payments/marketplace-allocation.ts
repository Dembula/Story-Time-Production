import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";
import { STORYTIME_TRANSACTION_FEE_LABEL } from "@/lib/payments/config";

/** Wallet marketplace purchase: debit buyer, credit seller pending + platform fee. */
export async function postMarketplacePaymentAllocation(args: {
  payerUserId: string;
  sellerUserId: string;
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  paymentSource: "wallet" | "gateway";
  paymentRecordId?: string;
}) {
  if (args.paymentSource === "gateway") {
    return;
  }

  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);
  await ensureWalletForUser(args.payerUserId);
  await ensureWalletForUser(args.sellerUserId);

  const entries = [
    {
      userId: args.payerUserId,
      direction: "DEBIT" as const,
      accountType: "AVAILABLE" as const,
      transactionType: "marketplace_purchase",
      amount: args.totalAmount,
      description: "Marketplace wallet purchase",
    },
    {
      userId: args.sellerUserId,
      direction: "CREDIT" as const,
      accountType: "PENDING" as const,
      transactionType: "marketplace_vendor_pending",
      amount: args.baseAmount,
      description: "Pending vendor earnings (paid out monthly)",
    },
    ...(args.feeAmount > 0
      ? [
          {
            userId: treasuryUserId,
            direction: "CREDIT" as const,
            accountType: "PLATFORM_REVENUE" as const,
            transactionType: "storytime_transaction_fee",
            amount: args.feeAmount,
            description: STORYTIME_TRANSACTION_FEE_LABEL,
          },
        ]
      : []),
  ];

  await postBalancedLedgerBatch({
    idempotencyKey: args.idempotencyKey,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    metadata: {
      paymentSource: args.paymentSource,
      paymentRecordId: args.paymentRecordId ?? null,
      baseAmount: args.baseAmount,
      feeAmount: args.feeAmount,
      feeLabel: STORYTIME_TRANSACTION_FEE_LABEL,
    },
    entries,
  });
}
