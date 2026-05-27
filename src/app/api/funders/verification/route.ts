import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessFunderVerificationApi, requireSessionUser } from "@/lib/funders";
import { validateIdOrPassportByCountry, validateIdOrPassportByCountryIfPresent } from "@/lib/kyc-validation";
import {
  extractKycDocumentsFromPayload,
  syncFunderKycVerifications,
  syncUserContactFromKyc,
} from "@/lib/kyc-verification-sync";
import type { KycPayload } from "@/lib/payout-kyc";

type KycDocumentInput = { documentType: string; documentUrl: string };

function validateFunderSubmission(payload?: KycPayload, documents?: KycDocumentInput[]): string | null {
  const kyc = payload ?? {};
  const docs = Array.isArray(documents) ? documents : [];
  const hasDoc = (type: string) => docs.some((d) => d.documentType === type && d.documentUrl?.trim());

  if (!kyc.basicIdentity?.fullName?.trim() || !kyc.basicIdentity?.idNumber?.trim() || !kyc.basicIdentity?.dateOfBirth?.trim()) {
    return "Complete full name, ID/passport number, and date of birth.";
  }
  if (!kyc.addressInfo?.residentialAddress?.trim() || !kyc.addressInfo?.city?.trim() || !kyc.addressInfo?.country?.trim()) {
    return "Complete residential address details before submitting.";
  }
  if (!hasDoc("ID_FRONT") || !hasDoc("ID_BACK") || !hasDoc("SELFIE")) {
    return "Required documents are missing (ID front, ID back, selfie).";
  }
  if (kyc.businessVerification?.isBusinessApplicant) {
    if (
      !kyc.businessVerification.companyName?.trim() ||
      !kyc.businessVerification.registrationNumber?.trim() ||
      !hasDoc("COMPANY_REGISTRATION")
    ) {
      return "Business applicants must provide company details and registration documents.";
    }
  }
  if (!kyc.financialInfo?.bankName?.trim() || !kyc.financialInfo?.accountHolderName?.trim() || !kyc.financialInfo?.accountNumber?.trim()) {
    return "Complete required banking details before submitting.";
  }
  if (
    !kyc.riskCompliance?.sanctionsDeclarationAccepted ||
    !kyc.riskCompliance?.termsAccepted ||
    !kyc.riskCompliance?.popiaConsentAccepted
  ) {
    return "Accept required declarations and consent before submitting.";
  }
  return null;
}

function parseRiskLevel(payload: KycPayload): "LOW" | "MEDIUM" | "HIGH" {
  if (payload.riskCompliance?.politicallyExposedPerson) return "HIGH";
  return "LOW";
}

export async function GET() {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!canAccessFunderVerificationApi(access.role!)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await prisma.funderProfile.findUnique({
    where: { userId: access.userId! },
    include: {
      verifications: { orderBy: { submittedAt: "desc" } },
    },
  });

  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!canAccessFunderVerificationApi(access.role!)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | {
        entityType?: string;
        legalName?: string;
        investmentThesis?: string;
        typicalCheckMin?: number | null;
        typicalCheckMax?: number | null;
        preferredStages?: string[] | null;
        preferredMarkets?: string[] | null;
        preferredRegions?: string[] | null;
        documents?: KycDocumentInput[];
        kycData?: KycPayload;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const legalName = body?.legalName?.trim() || body?.kycData?.basicIdentity?.fullName?.trim();
  const documents = Array.isArray(body.documents) ? body.documents : [];
  if (!legalName || documents.length < 3) {
    return NextResponse.json(
      { error: "Full legal name and required KYC files (ID front/back + selfie) are required." },
      { status: 400 },
    );
  }
  const idFormatError = validateIdOrPassportByCountry(
    body.kycData?.addressInfo?.country || body.kycData?.basicIdentity?.nationality,
    body.kycData?.basicIdentity?.idNumber,
  );
  if (idFormatError) {
    return NextResponse.json({ error: idFormatError }, { status: 400 });
  }
  const submissionError = validateFunderSubmission(body.kycData, documents);
  if (submissionError) {
    return NextResponse.json({ error: submissionError }, { status: 400 });
  }

  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.funderProfile.upsert({
      where: { userId: access.userId! },
      create: {
        userId: access.userId!,
        entityType: body.entityType?.trim() || "INDIVIDUAL",
        legalName,
        investmentThesis: body.investmentThesis?.trim() || null,
        typicalCheckMin: body.typicalCheckMin ?? null,
        typicalCheckMax: body.typicalCheckMax ?? null,
        preferredStages: JSON.stringify(body.preferredStages ?? []),
        preferredMarkets: JSON.stringify(body.preferredMarkets ?? []),
        preferredRegions: JSON.stringify(body.preferredRegions ?? []),
        kycData: (body.kycData ?? {}) as Prisma.InputJsonValue,
        verificationStatus: "PENDING",
        riskLevel: parseRiskLevel(body.kycData ?? {}),
        submittedAt: new Date(),
        limitedAccessEnabled: true,
        adminReviewRequired: true,
      },
      update: {
        entityType: body.entityType?.trim() || undefined,
        legalName,
        investmentThesis: body.investmentThesis?.trim() || null,
        typicalCheckMin: body.typicalCheckMin ?? null,
        typicalCheckMax: body.typicalCheckMax ?? null,
        preferredStages: JSON.stringify(body.preferredStages ?? []),
        preferredMarkets: JSON.stringify(body.preferredMarkets ?? []),
        preferredRegions: JSON.stringify(body.preferredRegions ?? []),
        kycData: (body.kycData ?? {}) as Prisma.InputJsonValue,
        verificationStatus: "PENDING",
        riskLevel: parseRiskLevel(body.kycData ?? {}),
        submittedAt: new Date(),
      },
    });

    const docRefs =
      documents.length > 0 ? documents : extractKycDocumentsFromPayload(body.kycData ?? {});
    await syncFunderKycVerifications(tx, saved.id, access.userId!, docRefs);
    await syncUserContactFromKyc(tx, access.userId!, body.kycData ?? {});
    await tx.adminAuditLog.create({
      data: {
        adminUserId: access.userId!,
        action: "FUNDER_KYC_SUBMITTED",
        entityType: "FunderProfile",
        entityId: saved.id,
        oldValue: null as any,
        newValue: { verificationStatus: "PENDING", documentCount: documents.length },
      },
    });
    return saved;
  });

  return NextResponse.json({ ok: true, profileId: profile.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!canAccessFunderVerificationApi(access.role!)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | {
        legalName?: string;
        entityType?: string;
        kycData?: KycPayload;
      }
    | null;

  if (!body?.kycData) {
    return NextResponse.json({ error: "kycData is required." }, { status: 400 });
  }
  const kycPayload = body.kycData;
  const idFormatError = validateIdOrPassportByCountryIfPresent(
    kycPayload.addressInfo?.country || kycPayload.basicIdentity?.nationality,
    kycPayload.basicIdentity?.idNumber,
  );
  if (idFormatError) {
    return NextResponse.json({ error: idFormatError }, { status: 400 });
  }

  const legalName = body.legalName?.trim() || kycPayload.basicIdentity?.fullName?.trim() || null;
  const profile = await prisma.$transaction(async (tx) => {
    const existing = await tx.funderProfile.findUnique({
      where: { userId: access.userId! },
      select: { submittedAt: true },
    });
    const draftStatusUpdate = existing?.submittedAt ? {} : { verificationStatus: "DRAFT" as const };

    const saved = await tx.funderProfile.upsert({
      where: { userId: access.userId! },
      create: {
        userId: access.userId!,
        legalName,
        entityType: body.entityType?.trim() || "INDIVIDUAL",
        verificationStatus: "DRAFT",
        riskLevel: parseRiskLevel(kycPayload),
        kycData: kycPayload as Prisma.InputJsonValue,
        limitedAccessEnabled: true,
        adminReviewRequired: true,
      },
      update: {
        legalName,
        entityType: body.entityType?.trim() || undefined,
        kycData: kycPayload as Prisma.InputJsonValue,
        riskLevel: parseRiskLevel(kycPayload),
        ...draftStatusUpdate,
      },
    });

    const docRefs = extractKycDocumentsFromPayload(kycPayload);
    if (docRefs.length > 0) {
      await syncFunderKycVerifications(tx, saved.id, access.userId!, docRefs);
    }
    await syncUserContactFromKyc(tx, access.userId!, kycPayload);

    await tx.adminAuditLog.create({
      data: {
        adminUserId: access.userId!,
        action: "FUNDER_KYC_DRAFT_SAVED",
        entityType: "FunderProfile",
        entityId: saved.id,
        oldValue: null as any,
        newValue: {
          hasBasicIdentity: Boolean(kycPayload.basicIdentity?.fullName),
          documentCount: docRefs.length,
        },
      },
    });

    return saved;
  });

  return NextResponse.json({ ok: true, profile });
}
