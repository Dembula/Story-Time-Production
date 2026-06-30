import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { diffContractTerms, summarizeContractDiff } from "@/lib/legal/contract-version-diff";

export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const versionA = url.searchParams.get("versionA");
  const versionB = url.searchParams.get("versionB");

  if (versionA && versionB) {
    const a = contract.versions.find((v) => v.id === versionA);
    const b = contract.versions.find((v) => v.id === versionB);
    if (!a || !b) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    const diff = diffContractTerms(a.terms, b.terms);
    return NextResponse.json({ diff, summary: summarizeContractDiff(diff), versionA: a, versionB: b });
  }

  return NextResponse.json({
    versions: contract.versions.map((v) => ({
      id: v.id,
      version: v.version,
      changeNotes: v.changeNotes,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}
