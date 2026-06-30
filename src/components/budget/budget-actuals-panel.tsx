"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetComparePanel } from "@/components/expense/budget-compare-panel";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";

type Props = { projectId: string };

export function BudgetActualsPanel({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["budget-actuals", projectId],
    queryFn: projectToolQueryFn<{ report: { totalPlanned: number; totalActual: number; rows: Array<{ key: string; budgeted: number; actual: number; committed?: number; remaining: number; variance: number; pctUsed?: number; health?: string }> } }>(
      `/api/creator/projects/${projectId}/financial-reports?type=actuals`,
    ),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const report = data?.report;
  if (!report) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          Live production spend vs AI Budget Studio plan — synced from Expense Tracker.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/creator/projects/${projectId}/financial-reports?type=actuals&format=csv`}
            className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            CSV
          </a>
          <a
            href={`/api/creator/projects/${projectId}/financial-reports?type=actuals&format=xlsx`}
            className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            Excel
          </a>
          <a
            href={`/api/creator/projects/${projectId}/financial-reports?type=actuals&format=pdf`}
            className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            PDF
          </a>
          <Link
            href={`/creator/projects/${projectId}/production/expense-tracker`}
            className="rounded-lg border border-orange-500/40 px-2 py-1 text-[11px] text-orange-300 hover:bg-orange-500/10"
          >
            Expense Tracker →
          </Link>
        </div>
      </div>
      <BudgetComparePanel
        rows={report.rows}
        overall={{
          budgeted: report.totalPlanned,
          actual: report.totalActual,
          remaining: report.totalPlanned - report.totalActual,
          variance: report.totalPlanned - report.totalActual,
        }}
      />
    </div>
  );
}
