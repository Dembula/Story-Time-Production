import { prisma } from "@/lib/prisma";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";
import { buildExpenseDashboard, parseExpenseRow } from "@/lib/expense-service";
import { buildFinancialAnalyticsDashboard } from "@/lib/financial-analytics-service";
import { buildDocumentPdf, type PdfBlock } from "@/lib/pdf/document-pdf";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildBudgetActualsReport(projectId: string) {
  const [budget, expensesRaw, funding, project] = await Promise.all([
    resolveDefaultProjectBudget(projectId),
    prisma.productionExpense.findMany({
      where: { projectId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    }),
    prisma.fundingRequest.findUnique({ where: { projectId } }),
    prisma.originalProject.findUnique({ where: { id: projectId }, include: { shootDays: { select: { id: true } } } }),
  ]);

  const expenseRows = expensesRaw.map(parseExpenseRow);
  const dashboard = buildExpenseDashboard(
    expenseRows,
    budget?.lines ?? [],
    budget?.totalPlanned ?? 0,
    funding?.amount ?? 0,
    project?.shootDays.length ?? 0,
  );

  return {
    generatedAt: new Date().toISOString(),
    projectId,
    totalPlanned: budget?.totalPlanned ?? 0,
    totalActual: dashboard.totalSpend,
    rows: dashboard.comparisonByDepartment ?? [],
    lineCount: budget?.lines.length ?? 0,
    expenseCount: expenseRows.length,
  };
}

export function budgetActualsToCsv(report: Awaited<ReturnType<typeof buildBudgetActualsReport>>): string {
  const header = ["Department", "Budgeted", "Actual", "Committed", "Remaining", "Variance", "PctUsed"];
  const lines = [header.join(",")];
  for (const r of report.rows) {
    lines.push(
      [
        csvEscape(r.key),
        r.budgeted,
        r.actual,
        r.committed ?? 0,
        r.remaining,
        r.variance,
        Math.round(r.pctUsed ?? 0),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function budgetActualsToExcelXml(report: Awaited<ReturnType<typeof buildBudgetActualsReport>>): string {
  const rows = report.rows
    .map(
      (r) =>
        `<Row><Cell><Data ss:Type="String">${r.key}</Data></Cell><Cell><Data ss:Type="Number">${r.budgeted}</Data></Cell><Cell><Data ss:Type="Number">${r.actual}</Data></Cell><Cell><Data ss:Type="Number">${r.remaining}</Data></Cell><Cell><Data ss:Type="Number">${r.variance}</Data></Cell></Row>`,
    )
    .join("");
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Actuals"><Table>${rows}</Table></Worksheet></Workbook>`;
}

export async function buildFinancialSummaryReport(projectId: string) {
  const analytics = await buildFinancialAnalyticsDashboard(projectId);
  return { analytics, generatedAt: new Date().toISOString() };
}

export function financialSummaryToPdfText(report: Awaited<ReturnType<typeof buildFinancialSummaryReport>>): Buffer {
  const k = report.analytics.kpis;
  const blocks: PdfBlock[] = [
    { type: "title", text: "FINANCIAL SUMMARY" },
    { type: "line", text: `Generated ${new Date(report.generatedAt).toLocaleString()}` },
    { type: "blank" },
    { type: "heading", text: "Key figures" },
    { type: "kv", label: "Actual spend", value: `R ${k.actualSpend.toFixed(2)}` },
    { type: "kv", label: "Remaining", value: `R ${k.remaining.toFixed(2)}` },
    { type: "kv", label: "Committed POs", value: `R ${k.committedPos.toFixed(2)}` },
    { type: "kv", label: "Forecast at completion", value: `R ${k.forecastAtCompletion.toFixed(2)}` },
    { type: "heading", text: "Department variance" },
  ];
  if (report.analytics.departmentVariance.length === 0) {
    blocks.push({ type: "line", text: "No department variance data." });
  } else {
    blocks.push({
      type: "table",
      headers: ["Department", "Budget", "Actual", "Variance"],
      rows: report.analytics.departmentVariance.slice(0, 40).map((d) => [
        d.department,
        `R ${Number(d.budgeted).toFixed(0)}`,
        `R ${Number(d.actual).toFixed(0)}`,
        `R ${Number(d.variance).toFixed(0)}`,
      ]),
    });
  }
  return buildDocumentPdf({ title: "Financial Summary", footer: "Story Time Finance", blocks });
}

export function budgetActualsToPdf(
  report: Awaited<ReturnType<typeof buildBudgetActualsReport>>,
): Buffer {
  const blocks: PdfBlock[] = [
    { type: "title", text: "BUDGET VS ACTUALS" },
    { type: "line", text: `Generated ${new Date().toLocaleString()}` },
    { type: "blank" },
    { type: "kv", label: "Total planned", value: `R ${Number(report.totalPlanned).toFixed(2)}` },
    { type: "kv", label: "Total actual", value: `R ${Number(report.totalActual).toFixed(2)}` },
    { type: "heading", text: "Line items" },
  ];
  if (report.rows.length === 0) {
    blocks.push({ type: "line", text: "No budget lines." });
  } else {
    blocks.push({
      type: "table",
      headers: ["Line", "Budget", "Actual", "Variance"],
      rows: report.rows.slice(0, 80).map((r) => [
        r.key,
        `R ${Number(r.budgeted).toFixed(0)}`,
        `R ${Number(r.actual).toFixed(0)}`,
        `R ${Number(r.variance).toFixed(0)}`,
      ]),
    });
  }
  return buildDocumentPdf({ title: "Budget vs Actuals", footer: "Story Time Finance", blocks });
}

export function expensesToCsv(expenses: Array<{ spentAt: Date; vendor: string | null; amount: number; department: string | null; description: string | null }>) {
  const header = ["Date", "Vendor", "Amount", "Department", "Description"];
  const lines = [header.join(",")];
  for (const e of expenses) {
    lines.push(
      [
        e.spentAt.toISOString().slice(0, 10),
        csvEscape(e.vendor ?? ""),
        e.amount,
        csvEscape(e.department ?? ""),
        csvEscape((e.description ?? "").slice(0, 80)),
      ].join(","),
    );
  }
  return lines.join("\n");
}
