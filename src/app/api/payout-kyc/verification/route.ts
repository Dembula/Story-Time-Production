import { NextRequest, NextResponse } from "next/server";
import type { InputJsonValue } from "@/lib/prisma-json";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateIdOrPassportByCountry, validateIdOrPassportByCountryIfPresent } from "@/lib/kyc-validation";
import {
  type KycPayload,
  parsePayoutKycRiskLevel,
  requiresPayoutKyc,
} from "@/lib/payout-kyc";
import {
  extractKycDocumentsFromPayload,
  mergeVerificationDocsIntoKycPayload,
  syncCreatorBankingFromKyc,
  syncPayoutKycVerifications,
  syncUserContactFromKyc,
} from "@/lib/kyc-verification-sync";

type KycDocumentInput = { documentType: string; documentUrl: string };

function validatePayoutSubmission(payload?: KycPayload, documents?: KycDocumentInput[]): string | null {
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

async function requirePayoutUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null, role: null };
  }
  if (!requiresPayoutKyc(user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null, role: null };
  }
  return { error: null, userId: user.id, role: user.role! };
}

export async function GET() {
  const access = await requirePayoutUser();
  if (access.error) return access.error;

  const profile = await prisma.payoutKycProfile.findUnique({
    where: { userId: access.userId! },
    include: { verifications: { orderBy: { submittedAt: "desc" } } },
  });

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({
    profile: {
      ...profile,
      kycData: mergeVerificationDocsIntoKycPayload(profile.kycData as KycPayload, profile.verifications),
    },
  });
}

export async function POST(req: NextRequest) {
  const access = await requirePayoutUser();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        legalName?: string;
        entityType?: string;
        documents?: KycDocumentInput[];
        kycData?: KycPayload;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const legalName = body.legalName?.trim() || body.kycData?.basicIdentity?.fullName?.trim();
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
  if (idFormatError) return NextResponse.json({ error: idFormatError }, { status: 400 });

  const submissionError = validatePayoutSubmission(body.kycData, documents);
  if (submissionError) return NextResponse.json({ error: submissionError }, { status: 400 });

  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.payoutKycProfile.upsert({
      where: { userId: access.userId! },
      create: {
        userId: access.userId!,
        accountRole: access.role!,
        entityType: body.entityType?.trim() || "INDIVIDUAL",
        legalName,
        kycData: (body.kycData ?? {}) as InputJsonValue,
        verificationStatus: "PENDING",
        riskLevel: parsePayoutKycRiskLevel(body.kycData ?? {}),
        submittedAt: new Date(),
        adminReviewRequired: true,
      },
      update: {
        entityType: body.entityType?.trim() || undefined,
        legalName,
        kycData: (body.kycData ?? {}) as InputJsonValue,
        verificationStatus: "PENDING",
        riskLevel: parsePayoutKycRiskLevel(body.kycData ?? {}),
        submittedAt: new Date(),
        reviewNote: null,
      },
    });

    const docRefs =
      documents.length > 0 ? documents : extractKycDocumentsFromPayload(body.kycData ?? {});
    await syncPayoutKycVerifications(tx, saved.id, access.userId!, docRefs);
    await syncUserContactFromKyc(tx, access.userId!, body.kycData ?? {});
    await syncCreatorBankingFromKyc(tx, access.userId!, body.kycData ?? {});

    await tx.adminAuditLog.create({
      data: {
        adminUserId: access.userId!,
        action: "PAYOUT_KYC_SUBMITTED",
        entityType: "PayoutKycProfile",
        entityId: saved.id,
        oldValue: {},
        newValue: { verificationStatus: "PENDING", documentCount: documents.length },
      },
    });

    return saved;
  });

  return NextResponse.json({ ok: true, profileId: profile.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const access = await requirePayoutUser();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | { legalName?: string; entityType?: string; kycData?: KycPayload }
    | null;

  if (!body?.kycData) return NextResponse.json({ error: "kycData is required." }, { status: 400 });

  const kycPayload = body.kycData;

  const idFormatError = validateIdOrPassportByCountryIfPresent(
    kycPayload.addressInfo?.country || kycPayload.basicIdentity?.nationality,
    kycPayload.basicIdentity?.idNumber,
  );
  if (idFormatError) return NextResponse.json({ error: idFormatError }, { status: 400 });

  const legalName = body.legalName?.trim() || kycPayload.basicIdentity?.fullName?.trim() || null;
  const profile = await prisma.$transaction(async (tx) => {
    const existing = await tx.payoutKycProfile.findUnique({
      where: { userId: access.userId! },
      select: { submittedAt: true },
    });
    const draftStatusUpdate = existing?.submittedAt ? {} : { verificationStatus: "DRAFT" as const };

    const saved = await tx.payoutKycProfile.upsert({
      where: { userId: access.userId! },
      create: {
        userId: access.userId!,
        accountRole: access.role!,
        legalName,
        entityType: body.entityType?.trim() || "INDIVIDUAL",
        verificationStatus: "DRAFT",
        riskLevel: parsePayoutKycRiskLevel(kycPayload),
        kycData: kycPayload as InputJsonValue,
        adminReviewRequired: true,
      },
      update: {
        legalName,
        entityType: body.entityType?.trim() || undefined,
        kycData: kycPayload as InputJsonValue,
        riskLevel: parsePayoutKycRiskLevel(kycPayload),
        ...draftStatusUpdate,
      },
    });

    const docRefs = extractKycDocumentsFromPayload(kycPayload);
    if (docRefs.length > 0) {
      await syncPayoutKycVerifications(tx, saved.id, access.userId!, docRefs);
    }
    await syncUserContactFromKyc(tx, access.userId!, kycPayload);
    await syncCreatorBankingFromKyc(tx, access.userId!, kycPayload);

    return saved;
  });

  return NextResponse.json({ ok: true, profile });
}
