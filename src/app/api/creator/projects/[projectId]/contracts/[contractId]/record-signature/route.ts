import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureProjectAccess } from "@/lib/project-access";
import { logContractEvent } from "@/lib/contract-lifecycle";
import { contractProjectLink } from "@/lib/contract-notification";
import { notifyUser } from "@/lib/notify-user";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

/** Creator records that the counterparty signed (e.g. on paper or via email link). */
export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, contractId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const session = await getServerSession(authOptions);
  const body = (await req.json().catch(() => null)) as
    | { signerName?: string; signerRole?: string; signedAt?: string }
    | null;

  const signerName =
    body?.signerName?.trim() ||
    session?.user?.name ||
    "Counterparty";

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      project: { select: { title: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      signatures: true,
    },
  });
  if (!contract?.versions[0]) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const recordableStatuses = ["SENT", "VIEWED", "AWAITING_SIGNATURE"];
  if (!recordableStatuses.includes(contract.status)) {
    return NextResponse.json(
      { error: `Cannot record signature while contract is ${contract.status}` },
      { status: 400 },
    );
  }

  const counterpartyUserId = contract.counterpartyUserId;
  const existingCounterpartySig = contract.signatures.some(
    (s) => (counterpartyUserId && s.userId === counterpartyUserId) || (!counterpartyUserId && s.role === "Counterparty"),
  );
  if (existingCounterpartySig) {
    return NextResponse.json({ error: "Counterparty signature is already recorded." }, { status: 400 });
  }

  const signedAt = body?.signedAt ? new Date(body.signedAt) : new Date();
  if (Number.isNaN(signedAt.getTime())) {
    return NextResponse.json({ error: "Invalid signedAt date" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.projectSignature.create({
      data: {
        contractId,
        versionId: contract.versions[0]!.id,
        userId: counterpartyUserId,
        name: signerName,
        role: body?.signerRole?.trim() || "Counterparty",
        signedAt,
      },
    });
    return tx.projectContract.update({
      where: { id: contractId },
      data: { status: "PARTIALLY_SIGNED" },
      include: { signatures: true, versions: { orderBy: { version: "desc" } } },
    });
  });

  await logContractEvent(contractId, "COUNTERPARTY_SIGNED_RECORDED", {
    userId,
    detail: `Producer recorded signature for ${signerName}`,
    metadata: { signerName, signedAt: signedAt.toISOString() },
  });

  if (counterpartyUserId) {
    await notifyUser({
      userId: counterpartyUserId,
      type: "CONTRACT_EVENT",
      title: "Contract signature recorded",
      body: `Your signature on ${contract.subject ?? "contract"} was recorded by the production team.`,
      metadata: {
        contractId,
        projectId,
        url: contractProjectLink(projectId, contractId),
      },
    });
  }

  return NextResponse.json({ contract: updated });
}
