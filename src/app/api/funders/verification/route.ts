import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFunderRole, requireSessionUser } from "@/lib/funders";

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
        documents?: Array<{ documentType: string; documentUrl: string }>;
      }
    | null;

  if (!body?.legalName || !Array.isArray(body.documents) || body.documents.length === 0) {
    return NextResponse.json({ error: "Legal name and at least one document are required." }, { status: 400 });
  }

  const profile = await prisma.funderProfile.upsert({
    where: { userId: access.userId! },
    create: {
      userId: access.userId!,
      entityType: body.entityType?.trim() || "INDIVIDUAL",
      legalName: body.legalName.trim(),
      investmentThesis: body.investmentThesis?.trim() || null,
      typicalCheckMin: body.typicalCheckMin ?? null,
      typicalCheckMax: body.typicalCheckMax ?? null,
      preferredStages: JSON.stringify(body.preferredStages ?? []),
      preferredMarkets: JSON.stringify(body.preferredMarkets ?? []),
      preferredRegions: JSON.stringify(body.preferredRegions ?? []),
      verificationStatus: "PENDING",
      limitedAccessEnabled: true,
      adminReviewRequired: true,
    },
    update: {
      entityType: body.entityType?.trim() || undefined,
      legalName: body.legalName.trim(),
      investmentThesis: body.investmentThesis?.trim() || null,
      typicalCheckMin: body.typicalCheckMin ?? null,
      typicalCheckMax: body.typicalCheckMax ?? null,
      preferredStages: JSON.stringify(body.preferredStages ?? []),
      preferredMarkets: JSON.stringify(body.preferredMarkets ?? []),
      preferredRegions: JSON.stringify(body.preferredRegions ?? []),
      verificationStatus: "PENDING",
    },
  });

  if (body.documents.length > 0) {
    await prisma.funderVerification.createMany({
      data: body.documents.map((doc) => ({
        funderProfileId: profile.id,
        submittedById: access.userId!,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: "PENDING",
      })),
    });
  }

  return NextResponse.json({ ok: true, profileId: profile.id }, { status: 201 });
}
