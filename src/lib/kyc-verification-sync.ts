import type { KycPayload } from "@/lib/payout-kyc";
import { applyKycDocumentToPayload, isPrivateKycStorageRef, mergeVerificationDocsIntoKycPayload } from "@/lib/kyc-form-documents";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export { mergeVerificationDocsIntoKycPayload } from "@/lib/kyc-form-documents";

export type KycDocumentRef = {
  documentType: string;
  documentUrl: string;
};

export function isPrivateStorageRef(url?: string | null): url is string {
  return isPrivateKycStorageRef(url);
}

/** Collect uploaded vault references from a KYC JSON payload. */
export function extractKycDocumentsFromPayload(kycData?: KycPayload | null): KycDocumentRef[] {
  if (!kycData) return [];

  const docs: KycDocumentRef[] = [];
  const idv = kycData.identityVerification;
  if (isPrivateStorageRef(idv?.idFrontUrl)) {
    docs.push({ documentType: "ID_FRONT", documentUrl: idv.idFrontUrl });
  }
  if (isPrivateStorageRef(idv?.idBackUrl)) {
    docs.push({ documentType: "ID_BACK", documentUrl: idv.idBackUrl });
  }
  if (isPrivateStorageRef(idv?.selfieUrl)) {
    docs.push({ documentType: "SELFIE", documentUrl: idv.selfieUrl });
  }

  const biz = kycData.businessVerification;
  if (isPrivateStorageRef(biz?.companyDocsUrl)) {
    docs.push({ documentType: "COMPANY_REGISTRATION", documentUrl: biz.companyDocsUrl });
  }
  if (isPrivateStorageRef(biz?.proofOfAddressUrl)) {
    docs.push({ documentType: "PROOF_OF_ADDRESS", documentUrl: biz.proofOfAddressUrl });
  }

  return docs;
}

async function applyPayoutKycVerifications(
  profileId: string,
  userId: string,
  documents: KycDocumentRef[],
): Promise<void> {
  const existing = await prisma.payoutKycVerification.findMany({
    where: { payoutKycProfileId: profileId },
  });
  const byType = new Map(existing.map((row) => [row.documentType, row]));
  const incomingTypes = new Set(documents.map((d) => d.documentType));

  for (const doc of documents) {
    const prev = byType.get(doc.documentType);
    if (prev) {
      if (prev.documentUrl !== doc.documentUrl) {
        await prisma.payoutKycVerification.update({
          where: { id: prev.id },
          data: {
            documentUrl: doc.documentUrl,
            status: prev.status === "APPROVED" ? "APPROVED" : "PENDING",
            submittedAt: new Date(),
          },
        });
      }
      continue;
    }
    await prisma.payoutKycVerification.create({
      data: {
        payoutKycProfileId: profileId,
        submittedById: userId,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: "PENDING",
      },
    });
  }

  const removable = existing.filter((row) => row.status === "PENDING" && !incomingTypes.has(row.documentType));
  if (removable.length > 0) {
    await prisma.payoutKycVerification.deleteMany({
      where: { id: { in: removable.map((r) => r.id) } },
    });
  }
}

async function applyFunderKycVerifications(
  profileId: string,
  userId: string,
  documents: KycDocumentRef[],
): Promise<void> {
  const existing = await prisma.funderVerification.findMany({
    where: { funderProfileId: profileId },
  });
  const byType = new Map(existing.map((row) => [row.documentType, row]));
  const incomingTypes = new Set(documents.map((d) => d.documentType));

  for (const doc of documents) {
    const prev = byType.get(doc.documentType);
    if (prev) {
      if (prev.documentUrl !== doc.documentUrl) {
        await prisma.funderVerification.update({
          where: { id: prev.id },
          data: {
            documentUrl: doc.documentUrl,
            status: prev.status === "APPROVED" ? "APPROVED" : "PENDING",
            submittedAt: new Date(),
          },
        });
      }
      continue;
    }
    await prisma.funderVerification.create({
      data: {
        funderProfileId: profileId,
        submittedById: userId,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: "PENDING",
      },
    });
  }

  const removable = existing.filter((row) => row.status === "PENDING" && !incomingTypes.has(row.documentType));
  if (removable.length > 0) {
    await prisma.funderVerification.deleteMany({
      where: { id: { in: removable.map((r) => r.id) } },
    });
  }
}

/** Used inside prisma.$transaction blocks from verification routes. */
export async function syncPayoutKycVerifications(
  tx: {
    payoutKycVerification: typeof prisma.payoutKycVerification;
    payoutKycProfile: typeof prisma.payoutKycProfile;
  },
  profileId: string,
  userId: string,
  documents: KycDocumentRef[],
): Promise<void> {
  const existing = await tx.payoutKycVerification.findMany({
    where: { payoutKycProfileId: profileId },
  });
  const byType = new Map(existing.map((row) => [row.documentType, row]));
  const incomingTypes = new Set(documents.map((d) => d.documentType));

  for (const doc of documents) {
    const prev = byType.get(doc.documentType);
    if (prev) {
      if (prev.documentUrl !== doc.documentUrl) {
        await tx.payoutKycVerification.update({
          where: { id: prev.id },
          data: {
            documentUrl: doc.documentUrl,
            status: prev.status === "APPROVED" ? "APPROVED" : "PENDING",
            submittedAt: new Date(),
          },
        });
      }
      continue;
    }
    await tx.payoutKycVerification.create({
      data: {
        payoutKycProfileId: profileId,
        submittedById: userId,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: "PENDING",
      },
    });
  }

  const removable = existing.filter((row) => row.status === "PENDING" && !incomingTypes.has(row.documentType));
  if (removable.length > 0) {
    await tx.payoutKycVerification.deleteMany({
      where: { id: { in: removable.map((r) => r.id) } },
    });
  }
}

export async function syncFunderKycVerifications(
  tx: {
    funderVerification: typeof prisma.funderVerification;
    funderProfile: typeof prisma.funderProfile;
  },
  profileId: string,
  userId: string,
  documents: KycDocumentRef[],
): Promise<void> {
  const existing = await tx.funderVerification.findMany({
    where: { funderProfileId: profileId },
  });
  const byType = new Map(existing.map((row) => [row.documentType, row]));
  const incomingTypes = new Set(documents.map((d) => d.documentType));

  for (const doc of documents) {
    const prev = byType.get(doc.documentType);
    if (prev) {
      if (prev.documentUrl !== doc.documentUrl) {
        await tx.funderVerification.update({
          where: { id: prev.id },
          data: {
            documentUrl: doc.documentUrl,
            status: prev.status === "APPROVED" ? "APPROVED" : "PENDING",
            submittedAt: new Date(),
          },
        });
      }
      continue;
    }
    await tx.funderVerification.create({
      data: {
        funderProfileId: profileId,
        submittedById: userId,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: "PENDING",
      },
    });
  }

  const removable = existing.filter((row) => row.status === "PENDING" && !incomingTypes.has(row.documentType));
  if (removable.length > 0) {
    await tx.funderVerification.deleteMany({
      where: { id: { in: removable.map((r) => r.id) } },
    });
  }
}

export async function registerPayoutKycUpload(
  userId: string,
  accountRole: string,
  documentType: string,
  storageRef: string,
): Promise<void> {
  const existing = await prisma.payoutKycProfile.findUnique({
    where: { userId },
    select: { kycData: true },
  });
  const kycData = applyKycDocumentToPayload((existing?.kycData ?? {}) as KycPayload, documentType, storageRef);

  const profile = await prisma.payoutKycProfile.upsert({
    where: { userId },
    create: {
      userId,
      accountRole,
      verificationStatus: "DRAFT",
      kycData: kycData as Prisma.InputJsonValue,
      adminReviewRequired: true,
    },
    update: {
      kycData: kycData as Prisma.InputJsonValue,
    },
  });
  await applyPayoutKycVerifications(profile.id, userId, [{ documentType, documentUrl: storageRef }]);
}

export async function registerFunderKycUpload(
  userId: string,
  documentType: string,
  storageRef: string,
): Promise<void> {
  const existing = await prisma.funderProfile.findUnique({
    where: { userId },
    select: { kycData: true },
  });
  const kycData = applyKycDocumentToPayload((existing?.kycData ?? {}) as KycPayload, documentType, storageRef);

  const profile = await prisma.funderProfile.upsert({
    where: { userId },
    create: {
      userId,
      verificationStatus: "DRAFT",
      kycData: kycData as Prisma.InputJsonValue,
      limitedAccessEnabled: true,
      adminReviewRequired: true,
    },
    update: {
      kycData: kycData as Prisma.InputJsonValue,
    },
  });
  await applyFunderKycVerifications(profile.id, userId, [{ documentType, documentUrl: storageRef }]);
}

/** Mirror identity contact fields onto the User row when present in KYC. */
export async function syncUserContactFromKyc(
  tx: { user: typeof prisma.user },
  userId: string,
  kycData?: KycPayload | null,
): Promise<void> {
  const basic = kycData?.basicIdentity;
  if (!basic) return;

  const data: { name?: string; email?: string; phoneNumber?: string } = {};
  if (basic.fullName?.trim()) data.name = basic.fullName.trim();
  if (basic.emailAddress?.trim()) {
    const email = basic.emailAddress.trim().toLowerCase();
    const taken = await tx.user.findFirst({
      where: { email, NOT: { id: userId } },
      select: { id: true },
    });
    if (!taken) data.email = email;
  }
  if (basic.phoneNumber?.trim()) data.phoneNumber = basic.phoneNumber.trim();

  if (Object.keys(data).length > 0) {
    await tx.user.update({ where: { id: userId }, data });
  }
}

export async function syncCreatorBankingFromKyc(
  tx: { creatorBanking: typeof prisma.creatorBanking },
  userId: string,
  kycData?: KycPayload | null,
): Promise<void> {
  const fin = kycData?.financialInfo;
  if (!fin?.bankName?.trim() || !fin.accountNumber?.trim() || !fin.accountHolderName?.trim()) return;

  await tx.creatorBanking.upsert({
    where: { userId },
    create: {
      userId,
      bankName: fin.bankName.trim(),
      accountNumber: fin.accountNumber.trim(),
      accountType: fin.accountType?.trim() || "CHEQUE",
      branchCode: fin.branchCode?.trim() || null,
    },
    update: {
      bankName: fin.bankName.trim(),
      accountNumber: fin.accountNumber.trim(),
      accountType: fin.accountType?.trim() || "CHEQUE",
      branchCode: fin.branchCode?.trim() || null,
    },
  });
}
