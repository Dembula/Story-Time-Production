import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess } from "@/lib/financial-ops-access";
import {
  buildBudgetActualsReport,
  budgetActualsToCsv,
  budgetActualsToExcelXml,
  buildFinancialSummaryReport,
  financialSummaryToPdfText,
  budgetActualsToPdf,
  expensesToCsv,
} from "@/lib/financial-ops/financial-reports-service";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const reportType = url.searchParams.get("type") ?? "actuals";

  if (reportType === "financial") {
    const report = await buildFinancialSummaryReport(projectId);
    if (format === "pdf") {
      const pdf = financialSummaryToPdfText(report);
      return new NextResponse(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=financial-summary.pdf" },
      });
    }
    return NextResponse.json(report);
  }

  if (reportType === "expenses" && (format === "csv" || format === "xlsx")) {
    const rows = await prisma.productionExpense.findMany({ where: { projectId }, orderBy: { spentAt: "desc" } });
    const csv = expensesToCsv(rows);
    if (format === "xlsx") {
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": "attachment; filename=expenses.csv",
        },
      });
    }
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=expenses.csv" },
    });
  }

  const report = await buildBudgetActualsReport(projectId);
  if (format === "csv") {
    return new NextResponse(budgetActualsToCsv(report), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=budget-actuals.csv" },
    });
  }
  if (format === "xlsx") {
    return new NextResponse(budgetActualsToExcelXml(report), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": "attachment; filename=budget-actuals.xls",
      },
    });
  }
  if (format === "pdf") {
    const pdf = budgetActualsToPdf(report);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="budget-actuals.pdf"',
      },
    });
  }

  return NextResponse.json({ report });
}
