"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import {
  flushOfflineExpenseQueue,
  getOfflineExpenseQueue,
  registerExpenseOfflineSync,
} from "@/lib/financial-ops/expense-offline-sync";

type Props = { projectId: string };

export function PettyCashPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [custodianId, setCustodianId] = useState("");
  const [floatAmount, setFloatAmount] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["petty-cash", projectId],
    queryFn: projectToolQueryFn<{ funds: Array<{ id: string; name: string; floatAmount: number; balance: number; custodian: { name: string | null } }> }>(
      `/api/creator/projects/${projectId}/petty-cash`,
    ),
  });

  const createMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/petty-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custodianUserId: custodianId, floatAmount: Number(floatAmount) }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["petty-cash", projectId] }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input value={custodianId} onChange={(e) => setCustodianId(e.target.value)} placeholder="Custodian user ID" className="max-w-xs text-xs" />
        <Input value={floatAmount} onChange={(e) => setFloatAmount(e.target.value)} placeholder="Float (ZAR)" className="max-w-[120px] text-xs" />
        <Button size="sm" disabled={!custodianId || !floatAmount} onClick={() => createMut.mutate()}>
          Create fund
        </Button>
      </div>
      {(data?.funds ?? []).map((f) => (
        <div key={f.id} className="rounded-lg border border-slate-800 p-3 text-xs flex justify-between">
          <span>
            {f.name} · {f.custodian.name ?? "Custodian"} · float R{f.floatAmount}
          </span>
          <span className={f.balance < f.floatAmount * 0.2 ? "text-amber-300" : "text-emerald-300"}>
            Balance R{f.balance}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BankImportPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["bank-import", projectId],
    queryFn: projectToolQueryFn<{ batches: Array<{ id: string; fileName: string | null; rowCount: number; matchedCount: number; createdAt: string }> }>(
      `/api/creator/projects/${projectId}/expenses/import-statement`,
    ),
  });

  const importMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/expenses/import-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: csv, fileName: "upload.csv" }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-import", projectId] });
      setCsv("");
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  return (
    <div className="space-y-3">
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={4}
        placeholder="Paste bank/card CSV (date, description, amount columns)…"
        className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200"
      />
      <Button size="sm" disabled={!csv.trim()} onClick={() => importMut.mutate()}>
        Import statement
      </Button>
      <ul className="space-y-1 text-xs text-slate-400">
        {(data?.batches ?? []).slice(0, 5).map((b) => (
          <li key={b.id}>
            {b.fileName ?? "import"} — {b.matchedCount}/{b.rowCount} matched · {new Date(b.createdAt).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OfflineSyncBanner({ projectId, onFlushed }: Props & { onFlushed?: () => void }) {
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    setQueued(getOfflineExpenseQueue(projectId).length);
    return registerExpenseOfflineSync(projectId, () => {
      setQueued(getOfflineExpenseQueue(projectId).length);
      onFlushed?.();
    });
  }, [projectId, onFlushed]);

  if (queued === 0 && (typeof navigator === "undefined" || navigator.onLine)) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 flex justify-between items-center">
      <span>
        {queued > 0 ? `${queued} expense(s) queued offline` : "Offline mode — expenses will sync when back online"}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px] border-amber-500/40"
        onClick={() => void flushOfflineExpenseQueue(projectId).then(() => setQueued(getOfflineExpenseQueue(projectId).length))}
      >
        Sync now
      </Button>
    </div>
  );
}

export function FinancialReportsPanel({ projectId }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        ["actuals", "csv", "Budget actuals CSV"],
        ["actuals", "xlsx", "Budget actuals Excel"],
        ["actuals", "pdf", "Budget actuals PDF"],
        ["financial", "pdf", "Financial summary PDF"],
        ["expenses", "csv", "All expenses CSV"],
      ].map(([type, format, label]) => (
        <a
          key={label}
          href={`/api/creator/projects/${projectId}/financial-reports?type=${type}&format=${format}`}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-orange-500/40 hover:text-orange-200"
        >
          {label}
        </a>
      ))}
    </div>
  );
}

export function FinanceApprovalPanel({
  projectId,
  entityType,
  entityId,
}: Props & { entityType: "EXPENSE" | "PO" | "PAYROLL"; entityId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["finance-approval", entityType, entityId],
    queryFn: projectToolQueryFn<{
      steps: Array<{
        id: string;
        stepOrder: number;
        status: string;
        approverRole: string | null;
        approver: { name: string | null } | null;
      }>;
    }>(`/api/creator/projects/${projectId}/finance-approvals/${entityType}/${entityId}`),
    enabled: !!entityId,
  });

  const setupMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/finance-approvals/${entityType}/${entityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: [{ approverRole: "PRODUCER" }, { approverRole: "FINANCE" }],
        }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-approval", entityType, entityId] }),
  });

  const decideMut = useMutation({
    mutationFn: (input: { stepId: string; decision: "APPROVED" | "REJECTED" }) =>
      fetch(`/api/creator/projects/${projectId}/finance-approvals/${entityType}/${entityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", ...input }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-approval", entityType, entityId] });
      if (entityType === "EXPENSE") qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
      if (entityType === "PO") qc.invalidateQueries({ queryKey: ["purchase-orders", projectId] });
    },
  });

  if (!entityId) return null;
  if (isLoading) return <Skeleton className="h-16 w-full" />;

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs">
      <p className="font-medium text-slate-300">Finance approval chain</p>
      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setupMut.mutate()}>
        Setup 2-step chain
      </Button>
      <ul className="space-y-1">
        {(data?.steps ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1.5">
            <span>
              Step {s.stepOrder} · {s.approverRole ?? "Approver"}
              {s.approver?.name ? ` (${s.approver.name})` : ""}
            </span>
            <div className="flex items-center gap-2">
              <span className={s.status === "APPROVED" ? "text-emerald-400" : s.status === "REJECTED" ? "text-red-400" : "text-amber-300"}>
                {s.status}
              </span>
              {s.status === "PENDING" && (
                <>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => decideMut.mutate({ stepId: s.id, decision: "APPROVED" })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => decideMut.mutate({ stepId: s.id, decision: "REJECTED" })}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {(data?.steps ?? []).length === 0 && <p className="text-slate-500">No approval steps configured.</p>}
    </div>
  );
}
