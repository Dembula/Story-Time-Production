import { prisma } from "@/lib/prisma";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";

function parseSalaryFromTerms(terms: string | null | undefined): number {
  if (!terms?.trim()) return 0;
  const patterns = [
    /Salary[^R\n]*R\s*([\d,]+(?:\.\d{2})?)/i,
    /compensation[^R\n]*R\s*([\d,]+(?:\.\d{2})?)/i,
    /fee[^R\n]*R\s*([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = terms.match(pattern);
    if (match?.[1]) {
      const parsed = Number.parseFloat(match[1].replace(/,/g, ""));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 0;
}

export async function resolveContractHireAmount(args: {
  projectId: string;
  contractType: string;
  hireAmount?: number | null;
  talentName?: string | null;
  crewLabel?: string | null;
  talentDailyRate?: number | null;
  terms?: string | null;
}): Promise<number> {
  if (args.hireAmount != null && args.hireAmount > 0) {
    return Math.round(args.hireAmount * 100) / 100;
  }

  const fromTerms = parseSalaryFromTerms(args.terms);
  if (fromTerms > 0) return fromTerms;

  const budget = await resolveDefaultProjectBudget(args.projectId);
  if (budget) {
    const department = args.contractType === "ACTOR" ? "CAST" : args.contractType === "CREW" ? "CREW" : null;
    const hint = (args.talentName ?? args.crewLabel ?? "").trim();
    if (department) {
      const lines = await prisma.projectBudgetLine.findMany({
        where: {
          budgetId: budget.id,
          department,
          name: { contains: "Salary", mode: "insensitive" },
        },
        take: 20,
      });
      const matched =
        hint.length > 0
          ? lines.find(
              (line) =>
                line.name.toLowerCase().includes(hint.toLowerCase()) ||
                (line.notes ?? "").toLowerCase().includes(hint.toLowerCase()),
            )
          : lines[0];
      if (matched && matched.total > 0) return Math.round(matched.total * 100) / 100;
    }
  }

  if (args.contractType === "ACTOR" && args.talentDailyRate && args.talentDailyRate > 0) {
    const shootDays = await prisma.shootDay.count({ where: { projectId: args.projectId } });
    const days = Math.max(1, shootDays);
    return Math.round(args.talentDailyRate * days * 100) / 100;
  }

  return 0;
}
