import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONTRACT_STATUS } from "@/lib/contract-template-engine";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, contractId } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        action: "VIEW" | "ACCEPT" | "REJECT" | "REQUEST_CHANGES";
        comment?: string | null;
        signerName?: string | null;
        signerRole?: string | null;
      }
    | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      project: { include: { members: true, pitches: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const isProjectMember =
    role === "ADMIN" ||
    contract.project.members.some((m) => m.userId === userId) ||
    contract.project.pitches.some((p) => p.creatorId === userId);
  const isCounterparty = contract.counterpartyUserId === userId;
  if (!isProjectMember && !isCounterparty) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let nextStatus = contract.status;
  if (body.action === "VIEW") nextStatus = CONTRACT_STATUS.VIEWED;
  if (body.action === "REJECT") nextStatus = CONTRACT_STATUS.REJECTED;
  if (body.action === "REQUEST_CHANGES") nextStatus = CONTRACT_STATUS.CHANGES_REQUESTED;
  if (body.action === "ACCEPT") nextStatus = CONTRACT_STATUS.SIGNED;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.projectContract.update({
      where: { id: contractId },
      data: { status: nextStatus },
    });

    if (body.action === "ACCEPT" && contract.versions[0]) {
      const alreadySigned = await tx.projectSignature.findFirst({
        where: {
          contractId,
          versionId: contract.versions[0].id,
          userId,
        },
      });
      if (!alreadySigned) {
        await tx.projectSignature.create({
          data: {
            contractId,
            versionId: contract.versions[0].id,
            userId,
            name: body.signerName ?? session.user?.name ?? "External signer",
            role: body.signerRole ?? "Counterparty",
          },
        });
      }
    }

    await tx.projectActivity.create({
      data: {
        projectId,
        userId,
        type: "CONTRACT_RECIPIENT_RESPONSE",
        message: `Contract response: ${body.action}.`,
        metadata: JSON.stringify({
          contractId,
          action: body.action,
          comment: body.comment ?? null,
        }),
      },
    });

    if (contract.createdById) {
      await tx.notification.create({
        data: {
          userId: contract.createdById,
          type: "CONTRACT_EVENT",
          title: "Contract response received",
          body: `${body.action} on ${contract.subject ?? "contract"} for ${contract.project.title}.`,
          metadata: JSON.stringify({
            projectId,
            contractId,
            action: body.action,
            status: nextStatus,
            comment: body.comment ?? null,
          }),
        },
      });
    }

    return c;
  });

  return NextResponse.json({ contract: updated });
}
