import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { contractDocumentToPdfBuffer } from "@/lib/legal/contract-pdf-export";

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      project: {
        select: {
          title: true,
          pitches: { orderBy: { createdAt: "desc" }, take: 1, select: { productionCompany: true } },
        },
      },
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });
  if (!contract?.versions[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const terms = contract.versions[0].terms;
  const header = contract.subject ?? contract.type;
  const pdf = contractDocumentToPdfBuffer({
    title: header,
    terms,
    status: contract.status,
    projectTitle: contract.project.title,
    productionCompany: contract.project.pitches[0]?.productionCompany ?? null,
    jurisdiction: contract.jurisdiction,
    recipientLabel: contract.recipientLabel ?? contract.vendorName,
    signatures: contract.signatures.map((s) => ({
      name: s.name ?? "Signer",
      role: s.role,
      signedAt: s.signedAt.toISOString(),
    })),
  });
  const filename = `${contract.subject ?? contract.type}-${contract.id.slice(0, 8)}.pdf`.replace(/[^\w.-]+/g, "_");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
