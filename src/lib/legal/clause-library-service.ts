import { prisma } from "@/lib/prisma";
import { applyClausePackToFields, getClausePack, listClausePackJurisdictions } from "@/lib/legal/clause-packs-data";

export async function listProjectClauses(projectId: string, opts?: { jurisdiction?: string; category?: string }) {
  return prisma.contractClause.findMany({
    where: {
      OR: [{ projectId }, { projectId: null }],
      ...(opts?.jurisdiction ? { jurisdiction: opts.jurisdiction } : {}),
      ...(opts?.category ? { category: opts.category } : {}),
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function createProjectClause(input: {
  projectId: string;
  userId: string;
  title: string;
  category: string;
  body: string;
  jurisdiction?: string | null;
  tags?: string[];
}) {
  return prisma.contractClause.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      category: input.category,
      body: input.body,
      jurisdiction: input.jurisdiction ?? null,
      tags: input.tags ?? [],
      createdById: input.userId,
    },
  });
}

export async function mergeClausesForContract(input: {
  projectId: string;
  jurisdiction: string;
  fields: Record<string, string>;
  clauseIds?: string[];
}) {
  const libraryClauses =
    input.clauseIds?.length ?
      await prisma.contractClause.findMany({
        where: {
          id: { in: input.clauseIds },
          OR: [{ projectId: input.projectId }, { projectId: null }],
        },
      })
    : [];

  const extra = libraryClauses.map((c) => `${c.title}\n${c.body}`);
  return applyClausePackToFields(input.fields, input.jurisdiction, extra);
}

export async function seedDefaultClauseLibrary(projectId: string, userId: string) {
  const existing = await prisma.contractClause.count({ where: { projectId, category: "standard" } });
  if (existing > 0) return { seeded: 0 };

  const defaults = [
    {
      title: "Force majeure",
      body: "Neither party shall be liable for delay caused by events beyond reasonable control including natural disaster, government action, or pandemic, provided prompt notice is given.",
    },
    {
      title: "Confidentiality",
      body: "Confidential information disclosed in connection with the production shall not be used or disclosed except as required for the production.",
    },
    {
      title: "Assignment",
      body: "Neither party may assign this agreement without prior written consent, except to a financing entity or successor production company on notice.",
    },
  ];

  await prisma.contractClause.createMany({
    data: defaults.map((d) => ({
      projectId,
      title: d.title,
      category: "standard",
      body: d.body,
      createdById: userId,
    })),
  });
  return { seeded: defaults.length };
}

export async function seedJurisdictionClausePacks(projectId: string, userId: string) {
  const existing = await prisma.contractClause.count({
    where: { projectId, category: "jurisdiction_pack" },
  });
  if (existing > 0) return { seeded: 0 };

  const rows = listClausePackJurisdictions().flatMap((jurisdiction) => {
    const pack = getClausePack(jurisdiction);
    return [
      {
        projectId,
        title: `${jurisdiction} — Governing law`,
        category: "jurisdiction_pack",
        jurisdiction,
        body: `Governing law: ${pack.governingLaw}\nCourts: ${pack.jurisdictionCourts}`,
        createdById: userId,
      },
      {
        projectId,
        title: `${jurisdiction} — Privacy`,
        category: "jurisdiction_pack",
        jurisdiction,
        body: pack.popiaClause,
        createdById: userId,
      },
      ...pack.mandatoryClauses.map((body, i) => ({
        projectId,
        title: `${jurisdiction} — Mandatory ${i + 1}`,
        category: "jurisdiction_pack",
        jurisdiction,
        body,
        createdById: userId,
      })),
    ];
  });

  await prisma.contractClause.createMany({ data: rows });
  return { seeded: rows.length };
}
