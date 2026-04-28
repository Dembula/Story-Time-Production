import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFunderRole, requireSessionUser } from "@/lib/funders";

export async function GET() {
  const access = await requireSessionUser();
  if (access.error) return access.error;

  const deals = await prisma.investmentDeal.findMany({
    where: {
      OR: [{ creatorUserId: access.userId! }, { funderUserId: access.userId! }],
    },
    include: {
      opportunity: true,
      creatorUser: { select: { id: true, name: true, professionalName: true } },
      funderUser: { select: { id: true, name: true, professionalName: true } },
      termSheets: { orderBy: { createdAt: "desc" }, take: 10 },
      negotiationMessages: { orderBy: { createdAt: "asc" }, take: 50 },
      contracts: { include: { signatures: true }, orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ deals });
}

export async function POST(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        action?: "EXPRESS_INTEREST" | "PROPOSE_TERMS" | "SEND_MESSAGE" | "GENERATE_CONTRACT" | "SIGN_CONTRACT" | "RECORD_PAYMENT" | "DECIDE_DEAL";
        opportunityId?: string;
        dealId?: string;
        creatorUserId?: string;
        message?: string;
        rejectionReason?: string;
        status?: string;
        termSheet?: {
          valuation?: number | null;
          investmentAmount: number;
          equityPercentage?: number | null;
          revenueSharePct?: number | null;
          recoupmentTerms?: string | null;
          milestones?: unknown;
        };
        contract?: { templateType?: string; body?: string | null };
        payment?: { amount: number; gatewayProvider?: string | null; gatewayReference?: string | null; metadata?: unknown };
      }
    | null;

  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });
  const funderProfile =
    access.role === "FUNDER"
      ? await prisma.funderProfile.findUnique({
          where: { userId: access.userId! },
          select: { verificationStatus: true },
        })
      : null;
  const isApprovedFunder =
    access.role !== "FUNDER" || funderProfile?.verificationStatus === "APPROVED";

  if (body.action === "EXPRESS_INTEREST") {
    if (!isFunderRole(access.role!)) return NextResponse.json({ error: "Only funders can express interest." }, { status: 403 });
    if (!body.opportunityId) return NextResponse.json({ error: "Missing opportunityId" }, { status: 400 });

    const opp = await prisma.investmentOpportunity.findUnique({ where: { id: body.opportunityId } });
    if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    const deal = await prisma.investmentDeal.create({
      data: {
        opportunityId: opp.id,
        projectId: opp.projectId,
        creatorUserId: opp.createdByUserId,
        funderUserId: access.userId!,
        pipelineStatus: "INTERESTED",
      },
    });
    return NextResponse.json({ deal }, { status: 201 });
  }

  if (!body.dealId) return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
  const existing = await prisma.investmentDeal.findUnique({ where: { id: body.dealId } });
  if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  if (![existing.creatorUserId, existing.funderUserId].includes(access.userId!)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "SEND_MESSAGE") {
    const msg = await prisma.dealNegotiationMessage.create({
      data: { dealId: existing.id, senderId: access.userId!, message: body.message?.trim() || "", messageType: "TEXT" },
    });
    return NextResponse.json({ message: msg });
  }

  if (body.action === "PROPOSE_TERMS") {
    if (!isApprovedFunder && access.userId === existing.funderUserId) {
      return NextResponse.json({ error: "Funder approval required before proposing terms." }, { status: 403 });
    }
    if (!body.termSheet) return NextResponse.json({ error: "Missing termSheet payload" }, { status: 400 });
    const terms = await prisma.dealTermSheet.create({
      data: {
        dealId: existing.id,
        investmentAmount: body.termSheet.investmentAmount,
        valuation: body.termSheet.valuation ?? null,
        equityPercentage: body.termSheet.equityPercentage ?? null,
        revenueSharePct: body.termSheet.revenueSharePct ?? null,
        recoupmentTerms: body.termSheet.recoupmentTerms ?? null,
        milestones: (body.termSheet.milestones as any) ?? null,
        proposedByRole: access.userId === existing.funderUserId ? "FUNDER" : "CREATOR",
        status: "PROPOSED",
      },
    });
    await prisma.investmentDeal.update({ where: { id: existing.id }, data: { pipelineStatus: "NEGOTIATING" } });
    return NextResponse.json({ termSheet: terms });
  }

  if (body.action === "GENERATE_CONTRACT") {
    if (!isApprovedFunder && access.userId === existing.funderUserId) {
      return NextResponse.json({ error: "Funder approval required before contract generation." }, { status: 403 });
    }
    if (!isFunderRole(access.role!) && access.userId !== existing.creatorUserId) {
      return NextResponse.json({ error: "Only participants can generate contracts." }, { status: 403 });
    }
    const contract = await prisma.dealContract.create({
      data: {
        dealId: existing.id,
        templateType: body.contract?.templateType ?? "INVESTMENT_AGREEMENT",
        generatedById: access.userId,
        body: body.contract?.body ?? "Template-generated contract terms placeholder.",
        status: "SENT",
      },
    });
    await prisma.investmentDeal.update({ where: { id: existing.id }, data: { pipelineStatus: "CONTRACT_PENDING" } });
    return NextResponse.json({ contract }, { status: 201 });
  }

  if (body.action === "SIGN_CONTRACT") {
    if (!isApprovedFunder && access.userId === existing.funderUserId) {
      return NextResponse.json({ error: "Funder approval required before signing contracts." }, { status: 403 });
    }
    if (!isFunderRole(access.role!) && access.userId !== existing.creatorUserId) {
      return NextResponse.json({ error: "Only participants can sign contracts." }, { status: 403 });
    }
    const latest = await prisma.dealContract.findFirst({ where: { dealId: existing.id }, orderBy: { createdAt: "desc" } });
    if (!latest) return NextResponse.json({ error: "No contract found for deal." }, { status: 404 });
    await prisma.dealContractSignature.create({
      data: { contractId: latest.id, signerUserId: access.userId!, signerRole: access.userId === existing.funderUserId ? "FUNDER" : "CREATOR" },
    });
    const signedByCreator = access.userId === existing.creatorUserId ? true : latest.signedByCreator;
    const signedByInvestor = access.userId === existing.funderUserId ? true : latest.signedByInvestor;
    const both = signedByCreator && signedByInvestor;
    const contract = await prisma.dealContract.update({
      where: { id: latest.id },
      data: {
        signedByCreator,
        signedByInvestor,
        status: both ? "SIGNED" : "PARTIALLY_SIGNED",
        signedAt: both ? new Date() : null,
      },
    });
    if (both) {
      await prisma.investmentDeal.update({ where: { id: existing.id }, data: { pipelineStatus: "SIGNING" } });
    }
    return NextResponse.json({ contract });
  }

  if (body.action === "RECORD_PAYMENT") {
    if (!isApprovedFunder && access.userId === existing.funderUserId) {
      return NextResponse.json({ error: "Funder approval required before processing payments." }, { status: 403 });
    }
    if (!body.payment?.amount || body.payment.amount <= 0) return NextResponse.json({ error: "Valid payment amount is required." }, { status: 400 });
    const payment = await prisma.dealPayment.create({
      data: {
        dealId: existing.id,
        initiatedById: access.userId!,
        amount: body.payment.amount,
        gatewayProvider: body.payment.gatewayProvider ?? "PAYSTACK_PLACEHOLDER",
        gatewayReference: body.payment.gatewayReference ?? null,
        metadata: (body.payment.metadata as any) ?? null,
        status: "AUTHORIZED",
      },
    });
    await prisma.investmentDeal.update({ where: { id: existing.id }, data: { pipelineStatus: "FUNDED", closedAt: new Date() } });
    return NextResponse.json({ payment }, { status: 201 });
  }

  if (body.action === "DECIDE_DEAL") {
    if (!isApprovedFunder && access.userId === existing.funderUserId) {
      return NextResponse.json({ error: "Funder approval required before deal decisions." }, { status: 403 });
    }
    const nextStatus = body.status === "REJECTED" ? "REJECTED" : "FUNDED";
    const deal = await prisma.investmentDeal.update({
      where: { id: existing.id },
      data: {
        pipelineStatus: nextStatus,
        rejectionReason: nextStatus === "REJECTED" ? body.rejectionReason?.trim() || "No reason provided." : null,
        respondedAt: new Date(),
      },
    });
    return NextResponse.json({ deal });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
