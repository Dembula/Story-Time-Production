import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/lib/prisma-json";
import type { KycPayload } from "@/lib/payout-kyc";
import { mergeVerificationDocsIntoKycPayload } from "@/lib/kyc-verification-sync";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return { adminId: null as string | null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { adminId: user.id, error: null as NextResponse | null };
}

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const profiles = await prisma.payoutKycProfile.findMany({
    where: { submittedAt: { not: null } },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          creatorAccountStructure: true,
          creatorBanking: {
            select: {
              bankName: true,
              accountNumber: true,
              accountType: true,
              branchCode: true,
              verifiedAt: true,
            },
          },
        },
      },
      verifications: { orderBy: { submittedAt: "desc" }, take: 30 },
    },
  });

  const payload = profiles.map((p) => {
    const docs = p.verifications;
    const kycData = mergeVerificationDocsIntoKycPayload(p.kycData as KycPayload, docs);
    const fin = kycData.financialInfo;
    return {
      ...p,
      kycData,
      // Full banking for admin payouts — never mask account numbers here.
      payoutBanking: {
        bankName: p.user.creatorBanking?.bankName ?? fin?.bankName ?? null,
        accountHolderName: fin?.accountHolderName ?? p.legalName ?? p.user.name ?? null,
        accountNumber: p.user.creatorBanking?.accountNumber ?? fin?.accountNumber ?? null,
        accountType: p.user.creatorBanking?.accountType ?? fin?.accountType ?? null,
        branchCode: p.user.creatorBanking?.branchCode ?? fin?.branchCode ?? null,
        bankStatementAsOf: fin?.bankStatementAsOf ?? null,
        verifiedAt: p.user.creatorBanking?.verifiedAt?.toISOString?.() ?? null,
        source: p.user.creatorBanking ? "creator_banking" : fin?.accountNumber ? "payout_kyc" : null,
      },
      reviewSummary: {
        totalDocs: docs.length,
        pendingCount: docs.filter((d) => d.status === "PENDING").length,
        approvedCount: docs.filter((d) => d.status === "APPROVED").length,
        rejectedCount: docs.filter((d) => d.status === "REJECTED").length,
      },
    };
  });

  return NextResponse.json({ profiles: payload });
}

export async function PATCH(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        payoutKycProfileId?: string;
        status?: "UNDER_REVIEW" | "APPROVED" | "REJECTED";
        note?: string | null;
      }
    | null;

  if (!body?.payoutKycProfileId || !body.status) {
    return NextResponse.json({ error: "payoutKycProfileId and status are required." }, { status: 400 });
  }

  const profile = await prisma.payoutKycProfile.findUnique({
    where: { id: body.payoutKycProfileId },
    include: { user: { select: { id: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const profileUpdated = await tx.payoutKycProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: body.status,
        reviewNote: body.note?.trim() || null,
        reviewedAt: new Date(),
        approvedForPayoutsAt: body.status === "APPROVED" ? new Date() : null,
      },
    });

    await tx.payoutKycVerification.updateMany({
      where: { payoutKycProfileId: profile.id, status: { in: ["PENDING", "UNDER_REVIEW"] } },
      data: {
        status: body.status === "REJECTED" ? "REJECTED" : "APPROVED",
        reviewedById: access.adminId!,
        note: body.note ?? null,
        reviewedAt: new Date(),
      },
    });

    if (body.status === "APPROVED") {
      const kyc = profileUpdated.kycData as KycPayload;
      const fin = kyc?.financialInfo;
      if (fin?.bankName && fin.accountNumber && fin.accountHolderName) {
        await tx.creatorBanking.upsert({
          where: { userId: profile.userId },
          create: {
            userId: profile.userId,
            bankName: fin.bankName.trim(),
            accountNumber: fin.accountNumber.trim(),
            accountType: fin.accountType?.trim() || "CHEQUE",
            branchCode: fin.branchCode?.trim() || null,
            verifiedAt: new Date(),
          },
          update: {
            bankName: fin.bankName.trim(),
            accountNumber: fin.accountNumber.trim(),
            accountType: fin.accountType?.trim() || "CHEQUE",
            branchCode: fin.branchCode?.trim() || null,
            verifiedAt: new Date(),
          },
        });
      }
    } else if (body.status === "REJECTED") {
      await tx.creatorBanking.updateMany({
        where: { userId: profile.userId },
        data: { verifiedAt: null },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        adminUserId: access.adminId!,
        action: "PAYOUT_KYC_REVIEW",
        entityType: "PayoutKycProfile",
        entityId: profile.id,
        oldValue: { verificationStatus: profile.verificationStatus } as InputJsonValue,
        newValue: { verificationStatus: body.status, note: body.note ?? null } as InputJsonValue,
      },
    });

    return profileUpdated;
  });

  return NextResponse.json({ profile: updated });
}
