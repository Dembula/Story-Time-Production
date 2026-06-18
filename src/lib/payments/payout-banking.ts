import "server-only";

import { prisma } from "@/lib/prisma";
import type { KycPayload } from "@/lib/payout-kyc-shared";

export type ResolvedPayoutBanking = {
  bankName: string;
  accountNumber: string;
  accountType: string;
  branchCode?: string | null;
  source: "creator_banking" | "payout_kyc" | "funder_kyc";
};

function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\s/g, "");
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

export function maskPayoutBanking(banking: ResolvedPayoutBanking) {
  return {
    bankName: banking.bankName,
    accountNumberMasked: maskAccountNumber(banking.accountNumber),
    accountType: banking.accountType,
    branchCode: banking.branchCode ?? null,
    source: banking.source,
  };
}

/** Banking details used for manual admin payouts — CreatorBanking or approved KYC financial info. */
export async function resolvePayoutBankingForUser(
  userId: string,
  role?: string | null,
): Promise<ResolvedPayoutBanking | null> {
  if (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR" || !role) {
    const banking = await prisma.creatorBanking.findUnique({
      where: { userId },
      select: { bankName: true, accountNumber: true, accountType: true, branchCode: true },
    });
    if (banking?.bankName && banking.accountNumber) {
      return {
        bankName: banking.bankName,
        accountNumber: banking.accountNumber,
        accountType: banking.accountType,
        branchCode: banking.branchCode,
        source: "creator_banking",
      };
    }
  }

  if (role === "FUNDER") {
    const profile = await prisma.funderProfile.findUnique({
      where: { userId },
      select: { kycData: true },
    });
    const financial = (profile?.kycData as KycPayload | null)?.financialInfo;
    if (financial?.bankName && financial.accountNumber) {
      return {
        bankName: financial.bankName,
        accountNumber: financial.accountNumber,
        accountType: financial.accountType ?? "CHEQUE",
        branchCode: financial.branchCode ?? null,
        source: "funder_kyc",
      };
    }
  }

  const kyc = await prisma.payoutKycProfile.findUnique({
    where: { userId },
    select: { kycData: true, verificationStatus: true },
  });
  const financial = (kyc?.kycData as KycPayload | null)?.financialInfo;
  if (kyc?.verificationStatus === "APPROVED" && financial?.bankName && financial.accountNumber) {
    return {
      bankName: financial.bankName,
      accountNumber: financial.accountNumber,
      accountType: financial.accountType ?? "CHEQUE",
      branchCode: financial.branchCode ?? null,
      source: "payout_kyc",
    };
  }

  return null;
}
