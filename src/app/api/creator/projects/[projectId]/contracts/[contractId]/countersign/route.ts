import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureProjectAccess } from "@/lib/project-access";
import { canUserSignAsCreator, logContractEvent } from "@/lib/contract-lifecycle";
import { contractProjectLink } from "@/lib/contract-notification";
import { notifyUser } from "@/lib/notify-user";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, contractId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | { signerName?: string; signerRole?: string }
    | null;

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      signatures: true,
    },
  });
  if (!contract?.versions[0]) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (!canUserSignAsCreator(contract, userId, true)) {
    return NextResponse.json(
      { error: "Counter-signature not available for this contract state." },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);
  const signerName = body?.signerName?.trim() || session?.user?.name || "Producer";

  const alreadySigned = contract.signatures.some((s) => s.userId === userId);
  if (alreadySigned) {
    return NextResponse.json({ error: "You have already signed this contract." }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.projectSignature.create({
      data: {
        contractId,
        versionId: contract.versions[0]!.id,
        userId,
        name: signerName,
        role: body?.signerRole ?? "Producer / Production Company",
      },
    });
    await tx.projectContract.update({
      where: { id: contractId },
      data: { status: "EXECUTED", executedAt: now },
    });
  });

  await logContractEvent(contractId, "COUNTERSIGNED", {
    userId,
    detail: `Producer counter-signed — contract executed`,
  });

  if (contract.counterpartyUserId) {
    await notifyUser({
      userId: contract.counterpartyUserId,
      type: "CONTRACT_EXECUTED",
      title: "Contract fully executed",
      body: `${contract.subject ?? "Contract"} has been counter-signed and is now executed.`,
      metadata: {
        contractId,
        projectId,
        url: contractProjectLink(projectId, contractId),
      },
    });
  }

  const updated = await prisma.projectContract.findUnique({
    where: { id: contractId },
    include: { signatures: true, versions: { orderBy: { version: "desc" } } },
  });

  return NextResponse.json({ contract: updated });
}
