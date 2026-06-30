import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/email";
import { logContractEvent } from "@/lib/contract-lifecycle";
import { CONTRACT_STATUS } from "@/lib/contract-template-engine";
import { contractProjectLink } from "@/lib/contract-notification";
import { notifyUser } from "@/lib/notify-user";

export type SignerInput = {
  partyRole: string;
  label: string;
  email?: string | null;
  userId?: string | null;
  signOrder?: number;
  required?: boolean;
};

export async function listContractSigners(contractId: string) {
  return prisma.contractSigner.findMany({
    where: { contractId },
    orderBy: { signOrder: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function replaceSignerRoster(contractId: string, signers: SignerInput[], signingMode: "PARALLEL" | "SEQUENTIAL") {
  await prisma.$transaction([
    prisma.contractSigner.deleteMany({ where: { contractId } }),
    ...signers.map((s, i) =>
      prisma.contractSigner.create({
        data: {
          contractId,
          partyRole: s.partyRole,
          label: s.label,
          email: s.email?.trim() || null,
          userId: s.userId ?? null,
          signOrder: signingMode === "SEQUENTIAL" ? i + 1 : s.signOrder ?? 0,
          required: s.required ?? true,
          status: "PENDING",
        },
      }),
    ),
  ]);
  await prisma.projectContract.update({
    where: { id: contractId },
    data: { signingMode },
  });
  return listContractSigners(contractId);
}

export function nextSequentialSigner(
  signers: Array<{ signOrder: number; status: string; required: boolean }>,
) {
  const ordered = [...signers].sort((a, b) => a.signOrder - b.signOrder);
  return ordered.find((s) => s.required && s.status === "PENDING") ?? null;
}

export async function canSignerActNow(contractId: string, signerId: string) {
  const contract = await prisma.projectContract.findUnique({
    where: { id: contractId },
    include: { signers: true },
  });
  if (!contract) return false;
  const signer = contract.signers.find((s) => s.id === signerId);
  if (!signer || signer.status !== "PENDING") return false;
  if (contract.signingMode === "PARALLEL") return true;
  const next = nextSequentialSigner(contract.signers);
  return next?.signOrder === signer.signOrder;
}

function guestSignUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/legal/sign/${token}`;
}

export async function eligibleGuestSigners(contractId: string) {
  const contract = await prisma.projectContract.findUnique({
    where: { id: contractId },
    include: { signers: true },
  });
  if (!contract) return [];

  let guests = contract.signers.filter(
    (s) => !s.userId && s.email?.trim() && s.status === "PENDING" && s.required,
  );

  if (guests.length === 0 && contract.recipientEmail?.trim() && !contract.counterpartyUserId) {
    return [] as typeof guests;
  }

  if (contract.signingMode === "SEQUENTIAL") {
    const nextOrder = nextSequentialSigner(contract.signers.filter((s) => s.required));
    if (!nextOrder) return [];
    const next = contract.signers.find((s) => s.signOrder === nextOrder.signOrder && s.required && s.status === "PENDING");
    if (!next || next.userId || !next.email) return [];
    return guests.filter((s) => s.id === next.id);
  }

  return guests;
}

export async function issueGuestSignTokens(contractId: string, expiresInDays = 14) {
  const contract = await prisma.projectContract.findUnique({ where: { id: contractId } });
  let signers = await eligibleGuestSigners(contractId);

  if (signers.length === 0 && contract?.recipientEmail?.trim() && !contract.counterpartyUserId) {
    const signer = await prisma.contractSigner.create({
      data: {
        contractId,
        partyRole: "COUNTERPARTY",
        label: contract.recipientLabel ?? contract.recipientEmail,
        email: contract.recipientEmail.trim(),
        signOrder: 1,
        required: true,
        status: "PENDING",
      },
    });
    signers = [signer];
  }

  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);
  const tokens: Array<{ email: string; url: string }> = [];

  for (const signer of signers) {
    if (!signer.email) continue;
    const existing = await prisma.contractGuestToken.findFirst({
      where: { signerId: signer.id, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existing) {
      tokens.push({ email: signer.email, url: guestSignUrl(existing.token) });
      continue;
    }
    const token = randomBytes(32).toString("hex");
    await prisma.contractGuestToken.create({
      data: {
        contractId,
        signerId: signer.id,
        email: signer.email,
        token,
        expiresAt,
      },
    });
    tokens.push({ email: signer.email, url: guestSignUrl(token) });
  }
  return tokens;
}

export async function emailGuestSignLinks(contractId: string, projectTitle: string, contractSubject: string) {
  const contract = await prisma.projectContract.findUnique({ where: { id: contractId }, select: { signingMode: true } });
  const tokens = await issueGuestSignTokens(contractId);
  let sent = 0;
  for (const t of tokens) {
    const ok = await sendTransactionalEmail({
      to: t.email,
      subject: `Contract to sign — ${projectTitle}`,
      text: `You have been sent a contract "${contractSubject}" for ${projectTitle}. Review and respond here: ${t.url}`,
      html: `<p>You have been sent a contract <strong>${contractSubject}</strong> for <strong>${projectTitle}</strong>.</p><p><a href="${t.url}">Review and respond to contract</a></p><p>Use the in-app approval form to approve, decline, or request changes. This link expires in 14 days.</p>${contract?.signingMode === "SEQUENTIAL" ? "<p>Other signers will receive their links after you complete your response.</p>" : ""}`,
    });
    if (ok) sent++;
  }
  if (sent > 0) {
    await logContractEvent(contractId, "GUEST_EMAIL_SENT", {
      detail: `Sent ${sent} guest sign link(s)`,
      metadata: { count: sent, signingMode: contract?.signingMode ?? "PARALLEL" },
    });
  }
  return { sent, total: tokens.length };
}

/** After a sequential-> notify the next guest in a sequential chain. */
export async function notifyNextSequentialGuestSigner(contractId: string) {
  const contract = await prisma.projectContract.findUnique({
    where: { id: contractId },
    include: { project: { select: { title: true } } },
  });
  if (!contract || contract.signingMode !== "SEQUENTIAL") return { sent: 0 };
  return emailGuestSignLinks(contractId, contract.project.title, contract.subject ?? "Contract");
}

export async function recordSignerSignature(input: {
  contractId: string;
  signerId: string;
  versionId: string;
  name: string;
  role: string;
  userId?: string | null;
  ipAddress?: string | null;
}) {
  const allowed = await canSignerActNow(input.contractId, input.signerId);
  if (!allowed) return { error: "Not your turn to sign or signer inactive" as const };

  await prisma.$transaction(async (tx) => {
    await tx.projectSignature.create({
      data: {
        contractId: input.contractId,
        versionId: input.versionId,
        userId: input.userId ?? null,
        name: input.name,
        role: input.role,
        ipAddress: input.ipAddress ?? null,
      },
    });
    await tx.contractSigner.update({
      where: { id: input.signerId },
      data: { status: "SIGNED", signedAt: new Date() },
    });
  });

  const contract = await prisma.projectContract.findUnique({
    where: { id: input.contractId },
    include: { signers: { where: { required: true } } },
  });
  if (!contract) return { error: "Contract not found" as const };

  const pendingRequired = contract.signers.filter((s) => s.status === "PENDING").length;
  const nextStatus = pendingRequired === 0 ? "AWAITING_SIGNATURE" : "PARTIALLY_SIGNED";
  await prisma.projectContract.update({
    where: { id: input.contractId },
    data: { status: nextStatus },
  });

  await notifyNextSequentialGuestSigner(input.contractId);

  return { error: null, pendingRequired };
}

export async function resolveGuestToken(token: string) {
  return prisma.contractGuestToken.findUnique({
    where: { token },
    include: {
      contract: {
        include: {
          project: { select: { title: true } },
          versions: { orderBy: { version: "desc" }, take: 1 },
          signers: true,
        },
      },
      signer: true,
    },
  });
}

export async function guestRespondToContract(input: {
  token: string;
  action: "ACCEPT" | "REJECT" | "REQUEST_CHANGES";
  signerName: string;
  comment?: string | null;
  ipAddress?: string | null;
}) {
  const guest = await resolveGuestToken(input.token);
  if (!guest) return { error: "Invalid link" as const };
  if (guest.usedAt) return { error: "Link already used" as const };
  if (guest.expiresAt < new Date()) return { error: "Link expired" as const };

  if (input.action === "ACCEPT") {
    return guestSignContract({
      token: input.token,
      signerName: input.signerName,
      ipAddress: input.ipAddress ?? null,
    });
  }

  if (guest.signerId) {
    const allowed = await canSignerActNow(guest.contractId, guest.signerId);
    if (!allowed) return { error: "Not your turn to respond or signer inactive" as const };
  }

  const nextStatus =
    input.action === "REJECT" ? CONTRACT_STATUS.REJECTED : CONTRACT_STATUS.CHANGES_REQUESTED;

  await prisma.$transaction(async (tx) => {
    if (guest.signerId) {
      await tx.contractSigner.update({
        where: { id: guest.signerId },
        data: { status: input.action === "REJECT" ? "DECLINED" : "PENDING" },
      });
    }
    await tx.projectContract.update({
      where: { id: guest.contractId },
      data: { status: nextStatus },
    });
    await tx.contractGuestToken.update({
      where: { id: guest.id },
      data: { usedAt: new Date() },
    });
  });

  const eventType = input.action === "REJECT" ? "GUEST_REJECTED" : "GUEST_REQUESTED_CHANGES";
  await logContractEvent(guest.contractId, eventType, {
    detail: `${input.signerName}: ${input.action}${input.comment ? ` — ${input.comment}` : ""}`,
    metadata: { email: guest.email, comment: input.comment ?? null },
  });

  const contract = guest.contract;
  if (contract.createdById) {
    const titles: Record<string, string> = {
      REJECT: "Contract declined by guest signer",
      REQUEST_CHANGES: "Guest signer requested contract changes",
    };
    await notifyUser({
      userId: contract.createdById,
      type: "CONTRACT_EVENT",
      title: titles[input.action] ?? "Contract response received",
      body: `${input.signerName} responded to ${contract.subject ?? "contract"} for ${contract.project.title}.`,
      metadata: {
        projectId: contract.projectId,
        contractId: contract.id,
        url: contractProjectLink(contract.projectId, contract.id),
        action: input.action,
        comment: input.comment ?? null,
      },
    });
  }

  return { error: null, contractId: guest.contractId };
}

export async function guestSignContract(input: {
  token: string;
  signerName: string;
  ipAddress?: string | null;
}) {
  const guest = await resolveGuestToken(input.token);
  if (!guest) return { error: "Invalid link" as const };
  if (guest.usedAt) return { error: "Link already used" as const };
  if (guest.expiresAt < new Date()) return { error: "Link expired" as const };
  if (!guest.signerId || !guest.contract.versions[0]) return { error: "Signer not configured" as const };

  const result = await recordSignerSignature({
    contractId: guest.contractId,
    signerId: guest.signerId,
    versionId: guest.contract.versions[0].id,
    name: input.signerName,
    role: guest.signer?.partyRole ?? "Guest signer",
    ipAddress: input.ipAddress ?? null,
  });
  if (result.error) return result;

  await prisma.contractGuestToken.update({
    where: { id: guest.id },
    data: { usedAt: new Date() },
  });

  await logContractEvent(guest.contractId, "GUEST_SIGNED", {
    detail: `${input.signerName} signed via email link`,
    metadata: { email: guest.email },
  });

  await notifyNextSequentialGuestSigner(guest.contractId);

  return { error: null, contractId: guest.contractId };
}
