import type { KycPayload } from "@/lib/payout-kyc-shared";

const DOCUMENT_FIELD_MAP: Record<string, { section: keyof KycPayload; field: string }> = {
  ID_FRONT: { section: "identityVerification", field: "idFrontUrl" },
  ID_BACK: { section: "identityVerification", field: "idBackUrl" },
  SELFIE: { section: "identityVerification", field: "selfieUrl" },
  COMPANY_REGISTRATION: { section: "businessVerification", field: "companyDocsUrl" },
  PROOF_OF_ADDRESS: { section: "businessVerification", field: "proofOfAddressUrl" },
};

export function isPrivateKycStorageRef(url?: string | null): url is string {
  return Boolean(url?.startsWith("s3://"));
}

/** Apply a single uploaded document reference onto a KYC JSON payload. */
export function applyKycDocumentToPayload<T extends KycPayload>(
  payload: T | null | undefined,
  documentType: string,
  storageRef: string,
): T {
  const mapping = DOCUMENT_FIELD_MAP[documentType];
  if (!mapping) {
    return { ...(payload ?? {}) } as T;
  }

  const base = { ...(payload ?? {}) } as T;
  const section = { ...((base[mapping.section] as Record<string, unknown> | undefined) ?? {}) };
  section[mapping.field] = storageRef.trim();
  return { ...base, [mapping.section]: section } as T;
}

/** Merge verification rows into kycData so UI and drafts always reflect uploaded vault files. */
export function mergeVerificationDocsIntoKycPayload(
  kycData: KycPayload | null | undefined,
  verifications: { documentType: string; documentUrl: string }[] | null | undefined,
): KycPayload {
  let merged = { ...(kycData ?? {}) } as KycPayload;
  for (const row of verifications ?? []) {
    if (isPrivateKycStorageRef(row.documentUrl)) {
      merged = applyKycDocumentToPayload(merged, row.documentType, row.documentUrl);
    }
  }
  return merged;
}

export function isKycStorageRefImage(storageRef: string): boolean {
  const key = storageRef.startsWith("s3://") ? storageRef.split("/").pop() ?? "" : storageRef;
  return /\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|$)/i.test(key);
}
