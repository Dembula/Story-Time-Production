import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateIdOrPassportByCountry } from "@/lib/kyc-validation";
import {
  type KycPayload,
  parsePayoutKycRiskLevel,
  requiresPayoutKyc,
} from "@/lib/payout-kyc";

type KycDocumentInput = { documentType: string; documentUrl: string };

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

  return NextResponse.json({ profile });
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

  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.payoutKycProfile.upsert({
      where: { userId: access.userId! },
      create: {
        userId: access.userId!,
        accountRole: access.role!,
        entityType: body.entityType?.trim() || "INDIVIDUAL",
        legalName,
        kycData: (body.kycData ?? {}) as Prisma.InputJsonValue,
        verificationStatus: "PENDING",
        riskLevel: parsePayoutKycRiskLevel(body.kycData ?? {}),
        submittedAt: new Date(),
        adminReviewRequired: true,
      },
      update: {
        entityType: body.entityType?.trim() || undefined,
        legalName,
        kycData: (body.kycData ?? {}) as Prisma.InputJsonValue,
        verificationStatus: "PENDING",
        riskLevel: parsePayoutKycRiskLevel(body.kycData ?? {}),
        submittedAt: new Date(),
        reviewNote: null,
      },
    });

    await tx.payoutKycVerification.deleteMany({
      where: { payoutKycProfileId: saved.id, status: "PENDING" },
    });
    await tx.payoutKycVerification.createMany({
      data: documents.map((doc) => ({
        payoutKycProfileId: saved.id,
        submittedById: access.userId!,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: "PENDING",
      })),
    });

    const fin = body.kycData?.financialInfo;
    if (fin?.bankName && fin.accountNumber && fin.accountHolderName) {
      await tx.creatorBanking.upsert({
        where: { userId: access.userId! },
        create: {
          userId: access.userId!,
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
          verifiedAt: null,
        },
      });
    }

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

  const idFormatError = validateIdOrPassportByCountry(
    body.kycData.addressInfo?.country || body.kycData.basicIdentity?.nationality,
    body.kycData.basicIdentity?.idNumber,
  );
  if (idFormatError) return NextResponse.json({ error: idFormatError }, { status: 400 });

  const legalName = body.legalName?.trim() || body.kycData.basicIdentity?.fullName?.trim() || null;
  const profile = await prisma.payoutKycProfile.upsert({
    where: { userId: access.userId! },
    create: {
      userId: access.userId!,
      accountRole: access.role!,
      legalName,
      entityType: body.entityType?.trim() || "INDIVIDUAL",
      verificationStatus: "PENDING",
      riskLevel: parsePayoutKycRiskLevel(body.kycData),
      kycData: body.kycData as Prisma.InputJsonValue,
      adminReviewRequired: true,
    },
    update: {
      legalName,
      entityType: body.entityType?.trim() || undefined,
      kycData: body.kycData as Prisma.InputJsonValue,
      riskLevel: parsePayoutKycRiskLevel(body.kycData),
    },
  });

  return NextResponse.json({ ok: true, profile });
}
