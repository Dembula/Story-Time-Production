import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";
import { resolveScriptText } from "./va-script-text";

const SLICE_LIMITS = {
  scenes: 12,
  characters: 15,
  budgetLines: 12,
  scriptChars: 6000,
  calendarDays: 14,
};

/** Inject only context slices relevant to the active tool/task — avoid flooding. */
export async function buildSlicedContext(params: {
  userId: string;
  projectId: string;
  tool?: string;
  task?: string;
}): Promise<string> {
  const { projectId, tool, task } = params;
  const sections: string[] = ["## Focused context slice (optimized)"];

  const needsScript =
    !tool ||
    tool.includes("script") ||
    tool.includes("breakdown") ||
    tool.includes("budget") ||
    task?.includes("script") ||
    task === "budget";

  const needsSchedule =
    tool?.includes("schedule") ||
    tool?.includes("control-center") ||
    tool?.includes("call-sheet") ||
    task === "schedule";

  const needsBudget = tool?.includes("budget") || task === "budget";

  if (needsScript) {
    const script = await prisma.projectScript.findFirst({
      where: { projectId },
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 1 },
        scenes: {
          take: SLICE_LIMITS.scenes,
          orderBy: { number: "asc" },
          select: { id: true, number: true, heading: true, summary: true },
        },
      },
    });
    if (script) {
      const text = resolveScriptText(script);
      const excerpt = text.slice(0, SLICE_LIMITS.scriptChars);
      sections.push(
        `**Script excerpt** (${script.title}, ${text.length} chars total, showing first ${excerpt.length}):`,
        excerpt || "(empty)",
      );
      if (script.scenes.length) {
        sections.push(
          "**Scenes (slice):**",
          script.scenes.map((s) => `- ${s.number}: ${s.heading ?? ""} ${s.summary?.slice(0, 80) ?? ""}`).join("\n"),
        );
      }
    }
    const chars = await prisma.breakdownCharacter.findMany({
      where: { projectId },
      take: SLICE_LIMITS.characters,
      select: { name: true, importance: true },
    });
    if (chars.length) {
      sections.push(
        "**Characters (slice):**",
        chars.map((c) => `- ${c.name} (${c.importance ?? "—"})`).join("\n"),
      );
    }
  }

  if (needsBudget) {
    const budget = await resolveDefaultProjectBudget(projectId);
    if (budget?.lines.length) {
      const lines = budget.lines.slice(0, SLICE_LIMITS.budgetLines);
      sections.push(
        "**Budget lines (slice):**",
        lines.map((l) => `- ${l.department ?? "—"}: ${l.name} (${l.total ?? "—"})`).join("\n"),
      );
    }
  }

  if (needsSchedule) {
    const days = await prisma.shootDay.findMany({
      where: { projectId },
      take: SLICE_LIMITS.calendarDays,
      orderBy: { date: "asc" },
      select: { id: true, date: true, unit: true, locationSummary: true },
    });
    if (days.length) {
      sections.push(
        "**Shoot days (slice):**",
        days
          .map(
            (d) =>
              `- id=${d.id} | ${d.date?.toISOString().slice(0, 10) ?? "TBD"} | ${d.unit ?? ""} | ${d.locationSummary ?? ""}`,
          )
          .join("\n"),
      );
    }
  }

  if (sections.length === 1) {
    return "";
  }

  return sections.join("\n\n");
}
