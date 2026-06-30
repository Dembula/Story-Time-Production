import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { createEsignEnvelope } from "@/lib/legal/contract-esign-service";

/** Creates an in-app signing envelope record (no external e-sign provider). */
export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = await req.json().catch(() => ({}));
  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: { signers: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signers =
    body.signers ??
    contract.signers.map((s) => ({
      email: s.email ?? "",
      name: s.label,
      role: s.partyRole,
      order: s.signOrder,
    }));

  const result = await createEsignEnvelope({ contractId, signers });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
