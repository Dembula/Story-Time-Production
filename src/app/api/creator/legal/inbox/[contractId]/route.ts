import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markContractViewed, canUserRespondAsCounterparty } from "@/lib/contract-lifecycle";

interface Params {
  params: Promise<{ contractId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contractId } = await params;

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, counterpartyUserId: userId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          pitches: { orderBy: { createdAt: "desc" }, take: 1, select: { productionCompany: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      versions: { orderBy: { version: "desc" } },
      signatures: { orderBy: { signedAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (["SENT", "VIEWED"].includes(contract.status)) {
    await markContractViewed(contractId, userId);
  }

  const refreshed = await prisma.projectContract.findUnique({
    where: { id: contractId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          pitches: { orderBy: { createdAt: "desc" }, take: 1, select: { productionCompany: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      versions: { orderBy: { version: "desc" } },
      signatures: { orderBy: { signedAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
    },
  });

  if (!refreshed) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const productionCompany = refreshed.project.pitches[0]?.productionCompany ?? null;

  return NextResponse.json({
    contract: {
      id: refreshed.id,
      projectId: refreshed.projectId,
      projectTitle: refreshed.project.title,
      productionCompany,
      type: refreshed.type,
      status: refreshed.status,
      subject: refreshed.subject,
      jurisdiction: refreshed.jurisdiction,
      recipientLabel: refreshed.recipientLabel ?? refreshed.vendorName,
      signatureDeadline: refreshed.signatureDeadline?.toISOString() ?? null,
      sentAt: refreshed.sentAt?.toISOString() ?? null,
      senderName: refreshed.createdBy?.name ?? null,
      canRespond: canUserRespondAsCounterparty(refreshed, userId),
      latestVersion: refreshed.versions[0]
        ? {
            id: refreshed.versions[0].id,
            version: refreshed.versions[0].version,
            terms: refreshed.versions[0].terms,
            createdAt: refreshed.versions[0].createdAt.toISOString(),
          }
        : null,
      versions: refreshed.versions.map((v) => ({
        id: v.id,
        version: v.version,
        changeNotes: v.changeNotes,
        createdAt: v.createdAt.toISOString(),
      })),
      signatures: refreshed.signatures.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        signedAt: s.signedAt.toISOString(),
      })),
      events: refreshed.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        detail: e.detail,
        actorName: e.user?.name ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    },
  });
}
