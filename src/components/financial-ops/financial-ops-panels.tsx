"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatZar } from "@/lib/format-currency-zar";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import { poStatusLabel } from "@/lib/financial-ops-types";
import { FinanceApprovalPanel } from "@/components/financial-ops/financial-roadmap-panels";

type Props = { projectId: string };

type VendorIntel = {
  vendor: { id: string; displayName: string; vendorType: string | null; paymentTerms: string | null; taxNumber: string | null };
  projectSpend: number;
  expenseCount: number;
  poCount: number;
  recentExpenses: Array<{ id: string; amount: number; spentAt: string }>;
  recentPos: Array<{ id: string; poNumber: string; total: number; status: string }>;
  global: {
    totalSpendAcrossProjects: number;
    projectCount: number;
    riskScore: number;
    avgPaymentDays: number | null;
  } | null;
};

export function VendorsPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["vendors", projectId],
    queryFn: projectToolQueryFn<{ vendors: Array<{ id: string; displayName: string; vendorType: string; status: string; _count: { purchaseOrders: number; expenses: number } }> }>(`/api/creator/projects/${projectId}/vendors`),
  });

  const createMut = useMutation({
    mutationFn: (displayName: string) =>
      fetch(`/api/creator/projects/${projectId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors", projectId] });
      setName("");
    },
  });

  const syncMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_from_contracts" }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors", projectId] }),
  });

  const rebuildMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rebuild_intelligence" }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors", projectId] });
      if (selectedVendorId) qc.invalidateQueries({ queryKey: ["vendor-intel", projectId, selectedVendorId] });
    },
  });

  const { data: intel, isLoading: intelLoading } = useQuery({
    queryKey: ["vendor-intel", projectId, selectedVendorId],
    queryFn: projectToolQueryFn<VendorIntel>(`/api/creator/projects/${projectId}/vendors?vendorId=${selectedVendorId}`),
    enabled: !!selectedVendorId,
  });

  const selectedVendor = (data?.vendors ?? []).find((v) => v.id === selectedVendorId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vendor name" className="max-w-xs" />
        <Button size="sm" disabled={!name.trim()} onClick={() => createMut.mutate(name.trim())}>
          Add vendor
        </Button>
        <Button size="sm" variant="outline" onClick={() => syncMut.mutate()}>
          Sync from contracts
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">POs</th>
              <th className="px-3 py-2">Expenses</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.vendors ?? []).map((v) => (
              <tr
                key={v.id}
                className={`cursor-pointer border-t border-slate-800/80 transition hover:bg-slate-800/40 ${selectedVendorId === v.id ? "bg-slate-800/60" : ""}`}
                onClick={() => setSelectedVendorId(v.id)}
              >
                <td className="px-3 py-2 text-slate-200">{v.displayName}</td>
                <td className="px-3 py-2 text-slate-400">{v.vendorType}</td>
                <td className="px-3 py-2">{v._count.purchaseOrders}</td>
                <td className="px-3 py-2">{v._count.expenses}</td>
                <td className="px-3 py-2 text-slate-400">{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedVendorId && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">Vendor intelligence</p>
              <p className="font-medium text-slate-100">{selectedVendor?.displayName ?? "Vendor"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelectedVendorId(null)}>
              Close
            </Button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
            {intelLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : intel ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                    <p className="text-[10px] uppercase text-slate-500">Project spend</p>
                    <p className="text-sm font-semibold text-slate-100">{formatZar(intel.projectSpend)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                    <p className="text-[10px] uppercase text-slate-500">Expenses / POs</p>
                    <p className="text-sm font-semibold text-slate-100">{intel.expenseCount} / {intel.poCount}</p>
                  </div>
                </div>
                {intel.global ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                    <p className="font-medium text-slate-300">Global network</p>
                    <p className="text-slate-400">Across {intel.global.projectCount} project(s): {formatZar(intel.global.totalSpendAcrossProjects)}</p>
                    <p className="text-slate-400">
                      Risk score: {(intel.global.riskScore * 100).toFixed(0)}%
                      {intel.global.avgPaymentDays != null ? ` · Avg payment ${intel.global.avgPaymentDays}d` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">Not linked to global vendor network yet.</p>
                )}
                {(intel.vendor.paymentTerms || intel.vendor.taxNumber) && (
                  <div className="rounded-lg border border-slate-800 p-3 text-slate-400">
                    {intel.vendor.paymentTerms && <p>Terms: {intel.vendor.paymentTerms}</p>}
                    {intel.vendor.taxNumber && <p>Tax #: {intel.vendor.taxNumber}</p>}
                  </div>
                )}
                <div>
                  <p className="mb-1 font-medium text-slate-300">Recent expenses</p>
                  <ul className="space-y-1">
                    {intel.recentExpenses.slice(0, 8).map((e) => (
                      <li key={e.id} className="flex justify-between text-slate-400">
                        <span>{new Date(e.spentAt).toLocaleDateString()}</span>
                        <span>{formatZar(e.amount)}</span>
                      </li>
                    ))}
                    {intel.recentExpenses.length === 0 && <li className="text-slate-500">None</li>}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 font-medium text-slate-300">Recent POs</p>
                  <ul className="space-y-1">
                    {intel.recentPos.slice(0, 8).map((p) => (
                      <li key={p.id} className="flex justify-between text-slate-400">
                        <span>{p.poNumber} · {poStatusLabel(p.status)}</span>
                        <span>{formatZar(p.total)}</span>
                      </li>
                    ))}
                    {intel.recentPos.length === 0 && <li className="text-slate-500">None</li>}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-slate-500">Could not load vendor intelligence.</p>
            )}
            <Button size="sm" variant="outline" disabled={rebuildMut.isPending} onClick={() => rebuildMut.mutate()}>
              Rebuild intelligence
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PurchaseOrdersPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", projectId],
    queryFn: projectToolQueryFn<{
      orders: Array<{
        id: string;
        poNumber: string;
        status: string;
        total: number;
        vendor: { displayName: string } | null;
        lines: Array<{
          id: string;
          description: string;
          quantity: number;
          unitCost: number;
          total: number;
          receivedQty: number;
        }>;
      }>;
    }>(`/api/creator/projects/${projectId}/purchase-orders`),
  });

  const createMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName,
          description: desc,
          lines: [{ description: desc || "Purchase", quantity: 1, unitCost: Number(amount) || 0 }],
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders", projectId] });
      setDesc("");
      setAmount("");
      setVendorName("");
    },
  });

  const poFetch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/creator/projects/${projectId}/purchase-orders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Purchase order action failed");
    return json;
  };

  const actionMut = useMutation({
    mutationFn: ({ poId, action }: { poId: string; action: string }) => poFetch({ poId, action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders", projectId] }),
  });

  const receiveMut = useMutation({
    mutationFn: ({ poId, lineId, receivedQty }: { poId: string; lineId: string; receivedQty: number }) =>
      poFetch({ poId, action: "receive", lineId, receivedQty }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders", projectId] }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor" />
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" />
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (ZAR)" type="number" />
        <Button size="sm" onClick={() => createMut.mutate()} disabled={!desc && !amount}>
          Create PO
        </Button>
      </div>
      <div className="space-y-2">
        {(data?.orders ?? []).map((po) => {
          const expanded = expandedPoId === po.id;
          const canReceive = ["SENT", "PARTIAL", "APPROVED"].includes(po.status);
          return (
            <div key={po.id} className="rounded-lg border border-slate-800 bg-slate-900/40 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <button type="button" className="font-medium text-orange-200 hover:underline" onClick={() => setExpandedPoId(expanded ? null : po.id)}>
                    {po.poNumber}
                  </button>
                  <span className="ml-2 text-slate-400">{po.vendor?.displayName ?? "—"}</span>
                  <span className="ml-2 text-slate-500">{poStatusLabel(po.status)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-200">{formatZar(po.total)}</span>
                  {po.status === "DRAFT" && (
                    <Button size="sm" variant="outline" onClick={() => actionMut.mutate({ poId: po.id, action: "submit" })}>
                      Submit
                    </Button>
                  )}
                  {po.status === "PENDING_APPROVAL" && (
                    <>
                      <Button size="sm" onClick={() => actionMut.mutate({ poId: po.id, action: "approve" })}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => actionMut.mutate({ poId: po.id, action: "reject" })}>
                        Reject
                      </Button>
                    </>
                  )}
                  {po.status === "APPROVED" && (
                    <Button size="sm" variant="outline" onClick={() => actionMut.mutate({ poId: po.id, action: "send" })}>
                      Mark sent
                    </Button>
                  )}
                  {canReceive && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setExpandedPoId(expanded ? null : po.id)}>
                        Receive
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => actionMut.mutate({ poId: po.id, action: "reconcile" })}>
                        Reconcile
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {expanded && (
                <div className="space-y-3 border-t border-slate-800 px-3 py-3">
                  <FinanceApprovalPanel projectId={projectId} entityType="PO" entityId={po.id} />
                  {(po.lines ?? []).length > 0 ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-300">Line items</p>
                      {(po.lines ?? []).map((line) => {
                        const remaining = Math.max(0, line.quantity - line.receivedQty);
                        return (
                          <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-200">{line.description}</p>
                              <p className="text-slate-500">
                                Ordered {line.quantity} · Received {line.receivedQty} · {formatZar(line.total)}
                              </p>
                            </div>
                            {canReceive && remaining > 0 && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={line.quantity}
                                  className="h-7 w-20 text-xs"
                                  placeholder={String(remaining)}
                                  value={receiveQty[line.id] ?? ""}
                                  onChange={(e) => setReceiveQty((p) => ({ ...p, [line.id]: e.target.value }))}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  disabled={receiveMut.isPending}
                                  onClick={() => {
                                    const qty = Number(receiveQty[line.id]);
                                    receiveMut.mutate({
                                      poId: po.id,
                                      lineId: line.id,
                                      receivedQty: Number.isFinite(qty) && qty > 0 ? qty : remaining,
                                    });
                                  }}
                                >
                                  Receive
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  disabled={receiveMut.isPending}
                                  onClick={() => receiveMut.mutate({ poId: po.id, lineId: line.id, receivedQty: line.quantity })}
                                >
                                  Receive all
                                </Button>
                              </div>
                            )}
                            {remaining === 0 && <span className="text-emerald-400">Fully received</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-500">No line items on this PO.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PayrollPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["payroll", projectId],
    queryFn: projectToolQueryFn<{
      runs: Array<{ id: string; label: string | null; status: string; totalGross: number; periodStart: string; periodEnd: string; _count: { lines: number } }>;
    }>(`/api/creator/projects/${projectId}/payroll`),
  });

  const genMut = useMutation({
    mutationFn: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return fetch(`/api/creator/projects/${projectId}/payroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_from_schedule",
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
        }),
      }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll", projectId] }),
  });

  const actionMut = useMutation({
    mutationFn: ({ runId, action }: { runId: string; action: string }) =>
      fetch(`/api/creator/projects/${projectId}/payroll`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, action }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll", projectId] }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => genMut.mutate()} disabled={genMut.isPending}>
        Generate from schedule (last 7 days)
      </Button>
      <div className="space-y-2">
        {(data?.runs ?? []).map((run) => (
          <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs">
            <div>
              <span className="font-medium text-slate-200">{run.label ?? "Payroll run"}</span>
              <span className="ml-2 text-slate-500">
                {run.periodStart.slice(0, 10)} – {run.periodEnd.slice(0, 10)} · {run._count.lines} lines
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{formatZar(run.totalGross)}</span>
              <span className="text-slate-500">{run.status}</span>
              {run.status === "DRAFT" && (
                <Button size="sm" variant="outline" onClick={() => actionMut.mutate({ runId: run.id, action: "approve" })}>
                  Approve
                </Button>
              )}
              {run.status === "APPROVED" && (
                <Button size="sm" onClick={() => actionMut.mutate({ runId: run.id, action: "pay" })}>
                  Mark paid
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinancialAnalyticsPanel({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["financial-analytics", projectId],
    queryFn: projectToolQueryFn<{
      dashboard: {
        kpis: {
          totalBudget: number;
          committedPos: number;
          actualSpend: number;
          payrollLiability: number;
          remaining: number;
          variancePct: number | null;
          burnRateWeekly: number;
          forecastAtCompletion: number;
        };
        departmentVariance: Array<{ department: string; budgeted: number; actual: number; committed: number; variance: number; health: string }>;
        vendorConcentration: Array<{ vendor: string; spend: number; pct: number }>;
        unitScheduleExposure: Array<{ unit: string; shootDays: number; estimatedCost: number }>;
        alerts: string[];
      };
    }>(`/api/creator/projects/${projectId}/financial-analytics`),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const d = data?.dashboard;
  if (!d) return <p className="text-sm text-slate-500">No analytics data.</p>;

  const kpis = [
    { label: "Budget", value: d.kpis.totalBudget },
    { label: "Committed (POs)", value: d.kpis.committedPos },
    { label: "Actual spend", value: d.kpis.actualSpend },
    { label: "Remaining", value: d.kpis.remaining },
    { label: "Weekly burn", value: d.kpis.burnRateWeekly },
    { label: "Forecast (EAC)", value: d.kpis.forecastAtCompletion },
  ];

  return (
    <div className="space-y-4">
      {d.alerts.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {d.alerts.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">{k.label}</p>
            <p className="text-sm font-semibold text-slate-100">{formatZar(k.value)}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 p-3">
          <h4 className="mb-2 text-xs font-medium text-slate-300">Department variance</h4>
          <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {d.departmentVariance.slice(0, 12).map((row) => (
              <div key={row.department} className="flex justify-between text-slate-400">
                <span>{row.department}</span>
                <span className={row.health === "over" ? "text-red-400" : row.health === "watch" ? "text-amber-400" : "text-emerald-400"}>
                  {formatZar(row.variance)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 p-3">
          <h4 className="mb-2 text-xs font-medium text-slate-300">Unit exposure</h4>
          {d.unitScheduleExposure.map((u) => (
            <div key={u.unit} className="flex justify-between text-xs text-slate-400">
              <span>Unit {u.unit} · {u.shootDays} days</span>
              <span>{formatZar(u.estimatedCost)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BudgetVersionsPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["budget-versions", projectId],
    queryFn: projectToolQueryFn<{
      versions: Array<{ id: string; version: number; label: string | null; totalPlanned: number; status: string; createdAt: string }>;
    }>(`/api/creator/projects/${projectId}/budget/versions`),
  });

  const { data: diffData } = useQuery({
    queryKey: ["budget-versions-diff", projectId, versionA, versionB],
    enabled: !!versionA && !!versionB,
    queryFn: projectToolQueryFn<{
      diff: Array<{ department: string; name: string; versionATotal: number; versionBTotal: number; delta: number }>;
    }>(`/api/creator/projects/${projectId}/budget/versions?versionA=${versionA}&versionB=${versionB}`),
  });

  const snapshotMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/budget/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `Snapshot ${new Date().toLocaleDateString()}` }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-versions", projectId] }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const versions = data?.versions ?? [];

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => snapshotMut.mutate()} disabled={snapshotMut.isPending}>
        Snapshot current budget
      </Button>
      <div className="space-y-1">
        {versions.map((v) => (
          <div key={v.id} className="flex justify-between rounded border border-slate-800 px-3 py-2 text-xs">
            <span className="text-slate-200">v{v.version} — {v.label ?? "Untitled"}</span>
            <span className="text-slate-400">{formatZar(v.totalPlanned)} · {v.status}</span>
          </div>
        ))}
      </div>
      {versions.length >= 2 && (
        <div className="space-y-2 rounded-lg border border-slate-800 p-3">
          <h4 className="text-xs font-medium text-slate-300">Compare versions</h4>
          <div className="flex flex-wrap gap-2">
            <select value={versionA} onChange={(e) => setVersionA(e.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
              <option value="">Version A</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>v{v.version}</option>
              ))}
            </select>
            <select value={versionB} onChange={(e) => setVersionB(e.target.value)} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
              <option value="">Version B</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>v{v.version}</option>
              ))}
            </select>
          </div>
          <div className="max-h-40 overflow-y-auto text-xs">
            {(diffData?.diff ?? []).slice(0, 20).map((row, i) => (
              <div key={i} className="flex justify-between text-slate-400">
                <span>{row.department} / {row.name}</span>
                <span className={row.delta > 0 ? "text-red-400" : "text-emerald-400"}>{formatZar(row.delta)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
