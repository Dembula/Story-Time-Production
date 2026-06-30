import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONTRACT_STATUS } from "@/lib/contract-template-engine";
import {
  canUserRespondAsCounterparty,
  logContractEvent,
  markContractViewed,
} from "@/lib/contract-lifecycle";
import { contractProjectLink } from "@/lib/contract-notification";
import { notifyUser } from "@/lib/notify-user";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
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
      project: { select: { title: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const isCounterparty = contract.counterpartyUserId === userId;
  if (!isCounterparty) {
    return NextResponse.json(
      { error: "Only the designated recipient can respond to this contract." },
      { status: 403 },
    );
  }

  if (body.action === "VIEW") {
    await markContractViewed(contractId, userId);
    const viewed = await prisma.projectContract.findUnique({ where: { id: contractId } });
    return NextResponse.json({ contract: viewed });
  }

  if (["ACCEPT", "REJECT", "REQUEST_CHANGES"].includes(body.action)) {
    if (!body.signerName?.trim() && !session.user?.name) {
      return NextResponse.json({ error: "Signer name required" }, { status: 400 });
    }
    if (
      (body.action === "REJECT" || body.action === "REQUEST_CHANGES") &&
      !body.comment?.trim()
    ) {
      return NextResponse.json(
        { error: "Comment required for decline or change requests" },
        { status: 400 },
      );
    }
  }

  if (!canUserRespondAsCounterparty(contract, userId)) {
    return NextResponse.json(
      { error: `Cannot ${body.action.toLowerCase()} contract in status ${contract.status}` },
      { status: 400 },
    );
  }

  let nextStatus = contract.status;
  if (body.action === "REJECT") nextStatus = CONTRACT_STATUS.REJECTED;
  if (body.action === "REQUEST_CHANGES") nextStatus = CONTRACT_STATUS.CHANGES_REQUESTED;
  if (body.action === "ACCEPT") nextStatus = "PARTIALLY_SIGNED";

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
            name: body.signerName ?? session.user?.name ?? "Counterparty",
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

    return c;
  });

  await logContractEvent(contractId, body.action, {
    userId,
    detail: body.comment ?? undefined,
    metadata: { status: nextStatus },
  });

  if (contract.createdById) {
    const titles: Record<string, string> = {
      ACCEPT: "Contract signed by recipient",
      REJECT: "Contract rejected",
      REQUEST_CHANGES: "Changes requested on contract",
    };
    await notifyUser({
      userId: contract.createdById,
      type: "CONTRACT_EVENT",
      title: titles[body.action] ?? "Contract response received",
      body: `${body.action} on ${contract.subject ?? "contract"} for ${contract.project.title}.`,
      metadata: {
        projectId,
        contractId,
        url: contractProjectLink(projectId, contractId),
        action: body.action,
        status: nextStatus,
        comment: body.comment ?? null,
      },
    });
  }

  return NextResponse.json({ contract: updated });
}
