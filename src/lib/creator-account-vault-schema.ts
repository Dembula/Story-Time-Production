/** JSON shape for `CreatorAccountProfileVault.data` — extended KYC / compliance fields. */

export type ComplianceDocStatus = "PENDING" | "APPROVED" | "REJECTED";

export type VaultComplianceDocument = {
  id: string;
  title: string;
  url: string;
  kind: string;
  uploadedAt?: string;
  expiresAt?: string;
  status: ComplianceDocStatus;
  notes?: string;
};

export type VaultIndividualIdentity = {
  legalFullName: string;
  displayOrStageName: string;
  idOrPassportNumber: string;
  dateOfBirth: string;
  nationality: string;
  gender: string;
  languagePreferences: string;
};

export type VaultCompanyIdentity = {
  registeredCompanyName: string;
  tradingName: string;
  cipcRegistrationNumber: string;
  companyType: string;
  vatNumber: string;
  industryClassification: string;
  dateOfRegistration: string;
  registeredAddress: string;
  operatingAddress: string;
  directorsJson: string;
  shareholdersJson: string;
  ultimateBeneficialOwner: string;
};

export type VaultSecurityExtended = {
  emailVerifiedNote: string;
  phoneOtpVerified: string;
  backupEmail: string;
  physicalAddressProof: string;
  twoFactorEnabled: string;
  deviceSessionNote: string;
  loginHistoryNote: string;
  activityLogNote: string;
  individualCertifiedIdUrl: string;
  individualSelfieVerificationUrl: string;
  individualProofOfAddressUrl: string;
  companyCor143Url: string;
  companyCor151aMoiUrl: string;
  companyDirectorIdUrls: string;
  companyProofOfBusinessAddressUrl: string;
  companyTcsPin: string;
};

export type VaultBankingExtended = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  accountTypeExtended: string;
  branchCode: string;
  bankConfirmationLetterUrl: string;
  nameMatchCheckNote: string;
  taxNumber: string;
  vatRegistrationNote: string;
  withholdingTaxNote: string;
  payoutSchedule: string;
  minimumPayoutThreshold: string;
  currency: string;
  totalEarningsNote: string;
  earningsPerProjectNote: string;
  pendingPayoutsNote: string;
  paidOutHistoryNote: string;
};

export type VaultPublicExtended = {
  bannerImageUrl: string;
  skillsRoles: string;
  portfolioNote: string;
  reputationNote: string;
};

export type VaultLegal = {
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  contentOwnershipDeclarationAt: string;
  revenueSharingAgreementAt: string;
  dataUsageConsentAt: string;
};

export type VaultBranding = {
  customProfileSlug: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandLogoUrl: string;
  watermarkNote: string;
};

export type VaultPlatformIntel = {
  accountTypeNote: string;
  subscriptionTierNote: string;
  pipelineUsageNote: string;
  aiToolingNote: string;
  productionActivityNote: string;
  engagementNote: string;
};

export type VaultFuture = {
  plannedKycIntegrations: string;
  plannedBankApis: string;
  plannedGovernmentChecks: string;
  plannedCreditScoring: string;
  plannedFundingEligibility: string;
};

export type CreatorAccountVaultData = {
  individual: VaultIndividualIdentity;
  company: VaultCompanyIdentity;
  securityExtended: VaultSecurityExtended;
  bankingExtended: VaultBankingExtended;
  publicExtended: VaultPublicExtended;
  documents: VaultComplianceDocument[];
  legal: VaultLegal;
  branding: VaultBranding;
  platformIntel: VaultPlatformIntel;
  future: VaultFuture;
};

function id(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyCreatorAccountVault(): CreatorAccountVaultData {
  return {
    individual: {
      legalFullName: "",
      displayOrStageName: "",
      idOrPassportNumber: "",
      dateOfBirth: "",
      nationality: "",
      gender: "",
      languagePreferences: "",
    },
    company: {
      registeredCompanyName: "",
      tradingName: "",
      cipcRegistrationNumber: "",
      companyType: "",
      vatNumber: "",
      industryClassification: "",
      dateOfRegistration: "",
      registeredAddress: "",
      operatingAddress: "",
      directorsJson: "",
      shareholdersJson: "",
      ultimateBeneficialOwner: "",
    },
    securityExtended: {
      emailVerifiedNote: "",
      phoneOtpVerified: "",
      backupEmail: "",
      physicalAddressProof: "",
      twoFactorEnabled: "",
      deviceSessionNote: "",
      loginHistoryNote: "",
      activityLogNote: "",
      individualCertifiedIdUrl: "",
      individualSelfieVerificationUrl: "",
      individualProofOfAddressUrl: "",
      companyCor143Url: "",
      companyCor151aMoiUrl: "",
      companyDirectorIdUrls: "",
      companyProofOfBusinessAddressUrl: "",
      companyTcsPin: "",
    },
    bankingExtended: {
      accountHolderName: "",
      bankName: "",
      accountNumber: "",
      accountTypeExtended: "",
      branchCode: "",
      bankConfirmationLetterUrl: "",
      nameMatchCheckNote: "",
      taxNumber: "",
      vatRegistrationNote: "",
      withholdingTaxNote: "",
      payoutSchedule: "",
      minimumPayoutThreshold: "",
      currency: "ZAR",
      totalEarningsNote: "",
      earningsPerProjectNote: "",
      pendingPayoutsNote: "",
      paidOutHistoryNote: "",
    },
    publicExtended: {
      bannerImageUrl: "",
      skillsRoles: "",
      portfolioNote: "",
      reputationNote: "",
    },
    documents: [],
    legal: {
      termsAcceptedAt: "",
      privacyAcceptedAt: "",
      contentOwnershipDeclarationAt: "",
      revenueSharingAgreementAt: "",
      dataUsageConsentAt: "",
    },
    branding: {
      customProfileSlug: "",
      brandPrimaryColor: "",
      brandSecondaryColor: "",
      brandLogoUrl: "",
      watermarkNote: "",
    },
    platformIntel: {
      accountTypeNote: "",
      subscriptionTierNote: "",
      pipelineUsageNote: "",
      aiToolingNote: "",
      productionActivityNote: "",
      engagementNote: "",
    },
    future: {
      plannedKycIntegrations: "",
      plannedBankApis: "",
      plannedGovernmentChecks: "",
      plannedCreditScoring: "",
      plannedFundingEligibility: "",
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function mergeDocRow(raw: unknown): VaultComplianceDocument | null {
  if (!isPlainObject(raw)) return null;
  const status = raw.status === "APPROVED" || raw.status === "REJECTED" ? raw.status : "PENDING";
  const title = String(raw.title ?? "").trim() || "Document";
  const url = String(raw.url ?? "").trim();
  if (!url) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : id(),
    title,
    url,
    kind: String(raw.kind ?? "other"),
    uploadedAt: typeof raw.uploadedAt === "string" ? raw.uploadedAt : undefined,
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : undefined,
    status,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  };
}

/** Shallow-merge known sections from stored JSON into defaults. */
export function normalizeCreatorAccountVault(raw: unknown): CreatorAccountVaultData {
  const base = emptyCreatorAccountVault();
  if (!isPlainObject(raw)) return base;

  const pick = <T extends Record<string, unknown>>(def: T, src: unknown): T => {
    if (!isPlainObject(src)) return def;
    const out = { ...def } as T;
    for (const k of Object.keys(def) as (keyof T)[]) {
      const v = src[k as string];
      if (typeof v === "string") (out as Record<string, unknown>)[k as string] = v;
    }
    return out;
  };

  return {
    individual: pick(base.individual, raw.individual),
    company: pick(base.company, raw.company),
    securityExtended: pick(base.securityExtended, raw.securityExtended),
    bankingExtended: pick(base.bankingExtended, raw.bankingExtended),
    publicExtended: pick(base.publicExtended, raw.publicExtended),
    legal: pick(base.legal, raw.legal),
    branding: pick(base.branding, raw.branding),
    platformIntel: pick(base.platformIntel, raw.platformIntel),
    future: pick(base.future, raw.future),
    documents: Array.isArray(raw.documents)
      ? (raw.documents.map(mergeDocRow).filter(Boolean) as VaultComplianceDocument[])
      : [],
  };
}

export function newComplianceDocumentRow(partial: Partial<VaultComplianceDocument> = {}): VaultComplianceDocument {
  return {
    id: id(),
    title: partial.title ?? "",
    url: partial.url ?? "",
    kind: partial.kind ?? "compliance",
    uploadedAt: partial.uploadedAt,
    expiresAt: partial.expiresAt,
    status: partial.status ?? "PENDING",
    notes: partial.notes,
  };
}
