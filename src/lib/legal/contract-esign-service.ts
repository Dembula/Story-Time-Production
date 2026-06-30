import { prisma } from "@/lib/prisma";
import { logContractEvent } from "@/lib/contract-lifecycle";

/** In-app signing only — no external DocuSign / HelloSign integration. */
export type EsignProvider = "STORYTIME";

export function isEsignConfigured(_provider: EsignProvider = "STORYTIME"): boolean {
  return true;
}

export async function createEsignEnvelope(input: {
  contractId: string;
  provider?: EsignProvider;
  signers: Array<{ email: string; name: string; role: string; order?: number }>;
}) {
  const contract = await prisma.projectContract.findUnique({
    where: { id: input.contractId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 }, project: { select: { title: true } } },
  });
  if (!contract) return { error: "Contract not found" as const, envelope: null };

  const externalId = `st-${input.contractId.slice(0, 8)}-${Date.now()}`;

  const envelope = await prisma.contractEsignEnvelope.create({
    data: {
      contractId: input.contractId,
      provider: "STORYTIME",
      externalId,
      status: "IN_APP",
      signersJson: input.signers,
    },
  });

  await prisma.projectContract.update({
    where: { id: input.contractId },
    data: {
      esignProvider: "STORYTIME",
      esignEnvelopeId: envelope.id,
    },
  });

  await logContractEvent(input.contractId, "ESIGN_ENVELOPE_CREATED", {
    detail: `In-app signing envelope ${externalId}`,
    metadata: { provider: "STORYTIME", envelopeId: envelope.id, providerStatus: "IN_APP" },
  });

  return { error: null, envelope };
}

export async function completeEsignEnvelope(envelopeId: string, metadata?: Record<string, unknown>) {
  const envelope = await prisma.contractEsignEnvelope.update({
    where: { id: envelopeId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await logContractEvent(envelope.contractId, "ESIGN_COMPLETED", { metadata });
  return envelope;
}
