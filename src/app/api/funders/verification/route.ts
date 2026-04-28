import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isFunderRole, requireSessionUser } from "@/lib/funders";
import { validateIdOrPassportByCountry } from "@/lib/kyc-validation";

type KycDocumentInput = { documentType: string; documentUrl: string };

type KycPayload = {
  basicIdentity?: {
    fullName?: string;
    idNumber?: string;
    dateOfBirth?: string;
    nationality?: string;
    phoneNumber?: string;
    emailAddress?: string;
  };
  addressInfo?: {
    residentialAddress?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
    country?: string;
  };
  businessVerification?: {
    isBusinessApplicant?: boolean;
    companyName?: string;
    registrationNumber?: string;
    roleInCompany?: string;
  };
  financialInfo?: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    accountType?: string;
    incomeRange?: string;
    sourceOfFunds?: string;
  };
  riskCompliance?: {
    politicallyExposedPerson?: boolean;
    sanctionsDeclarationAccepted?: boolean;
    termsAccepted?: boolean;
    popiaConsentAccepted?: boolean;
  };
};

function parseRiskLevel(payload: KycPayload): "LOW" | "MEDIUM" | "HIGH" {
  if (payload.riskCompliance?.politicallyExposedPerson) return "HIGH";
  return "LOW";
}

export async function GET() {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!isFunderRole(access.role!)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  if (!isFunderRole(access.role!)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    await tx.funderVerification.deleteMany({ where: { funderProfileId: saved.id, status: "PENDING" } });
    await tx.funderVerification.createMany({
      data: documents.map((doc) => ({
        funderProfileId: saved.id,
        submittedById: access.userId!,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: "PENDING",
      })),
    });
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
  if (!isFunderRole(access.role!)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
  const idFormatError = validateIdOrPassportByCountry(
    body.kycData.addressInfo?.country || body.kycData.basicIdentity?.nationality,
    body.kycData.basicIdentity?.idNumber,
  );
  if (idFormatError) {
    return NextResponse.json({ error: idFormatError }, { status: 400 });
  }

  const legalName = body.legalName?.trim() || body.kycData.basicIdentity?.fullName?.trim() || null;
  const profile = await prisma.funderProfile.upsert({
    where: { userId: access.userId! },
    create: {
      userId: access.userId!,
      legalName,
      entityType: body.entityType?.trim() || "INDIVIDUAL",
      verificationStatus: "PENDING",
      riskLevel: parseRiskLevel(body.kycData),
      kycData: body.kycData as Prisma.InputJsonValue,
      limitedAccessEnabled: true,
      adminReviewRequired: true,
    },
    update: {
      legalName,
      entityType: body.entityType?.trim() || undefined,
      kycData: body.kycData as Prisma.InputJsonValue,
      riskLevel: parseRiskLevel(body.kycData),
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: access.userId!,
      action: "FUNDER_KYC_DRAFT_SAVED",
      entityType: "FunderProfile",
      entityId: profile.id,
      oldValue: null as any,
      newValue: { hasBasicIdentity: Boolean(body.kycData.basicIdentity?.fullName) },
    },
  });

  return NextResponse.json({ ok: true, profile });
}
