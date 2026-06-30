import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { contractTermsToPdfBuffer } from "@/lib/legal/contract-pdf-export";
import { watermarkForStatus } from "@/lib/contract-lifecycle";

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 }, project: { select: { title: true } } },
  });
  if (!contract?.versions[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const terms = contract.versions[0].terms;
  const watermark = watermarkForStatus(contract.status);
  const header = `${contract.project.title} — ${contract.subject ?? contract.type}${watermark ? ` [${watermark}]` : ""}`;
  const pdf = contractTermsToPdfBuffer(terms, header);
  const filename = `${contract.subject ?? contract.type}-${contract.id.slice(0, 8)}.pdf`.replace(/[^\w.-]+/g, "_");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
