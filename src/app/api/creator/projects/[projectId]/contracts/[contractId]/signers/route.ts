import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { listContractSigners, replaceSignerRoster, emailGuestSignLinks } from "@/lib/legal/contract-signer-service";

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const contract = await prisma.projectContract.findFirst({ where: { id: contractId, projectId } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signers = await listContractSigners(contractId);
  return NextResponse.json({ signers, signingMode: contract.signingMode });
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = await req.json().catch(() => ({}));
  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: { project: { select: { title: true } } },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "resend_invites") {
    const result = await emailGuestSignLinks(
      contractId,
      contract.project.title,
      contract.subject ?? "Contract",
    );
    return NextResponse.json(result);
  }

  const signingMode = body.signingMode === "SEQUENTIAL" ? "SEQUENTIAL" : "PARALLEL";
  const signers = await replaceSignerRoster(contractId, body.signers ?? [], signingMode);
  return NextResponse.json({ signers, signingMode });
}
