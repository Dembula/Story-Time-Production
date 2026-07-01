"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Receipt,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { useModocToolRefresh } from "@/components/modoc/use-modoc-tool-refresh";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { formatZar } from "@/lib/format-currency-zar";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import { EXPENSE_CATEGORIES, categoryLabel } from "@/lib/expense-types";
import { ExpenseStudioNav, type ExpenseWorkspaceId } from "@/components/expense/expense-studio-nav";
import { BudgetComparePanel } from "@/components/expense/budget-compare-panel";
import {
  PurchaseOrdersPanel,
  VendorsPanel,
  PayrollPanel,
} from "@/components/financial-ops/financial-ops-panels";
import {
  OfflineSyncBanner,
  PettyCashPanel,
  FinancialReportsPanel,
  FinanceApprovalPanel,
} from "@/components/financial-ops/financial-roadmap-panels";
import { queueOfflineExpense } from "@/lib/financial-ops/expense-offline-sync";

type ExpenseRow = {
  id: string;
  amount: number;
  vendor: string | null;
  department: string | null;
  spentAt: string;
  meta: {
    title: string;
    category: string;
    sceneId: string | null;
    shootDayId: string | null;
    paymentMethod: string | null;
    notes: string | null;
    receiptUrls: string[];
    paymentProofUrls: string[];
    fundingSource: string | null;
    approvalStatus: string;
    paymentStatus: string;
    paymentDueAt: string | null;
    duplicateOfId: string | null;
    ocrConfidence: number | null;
    ocrRawText?: string | null;
  };
};

interface ExpenseTrackerStudioProps {
  projectId?: string;
  title: string;
}

export function ExpenseTrackerStudio({ projectId, title }: ExpenseTrackerStudioProps) {
  const queryClient = useQueryClient();
  const { deviceClass, orientation } = useAdaptiveUi();
  const hasProject = !!projectId;
  const [workspace, setWorkspace] = useState<ExpenseWorkspaceId>("dashboard");
  const [toast, setToast] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<Record<string, { value: unknown; confidence: number } | null> | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "MISCELLANEOUS",
    budgetLineId: "",
    sceneId: "",
    shootDayId: "",
    amount: "",
    vendor: "",
    paymentMethod: "OTHER",
    notes: "",
    fundingSource: "",
    paymentDueAt: "",
  });
  const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
  const [paymentProofUrls, setPaymentProofUrls] = useState<string[]>([]);

  useModocToolRefresh({ queryKeys: ["project-expenses", "project-budget"] });

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ["project-expenses", projectId],
    queryFn: async () => {
      const r = await fetch(`/api/creator/projects/${projectId}/expenses`);
      if (!r.ok) throw new Error("Failed to load expenses");
      return r.json();
    },
    enabled: hasProject,
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });

  const { data: budgetData } = useQuery({
    queryKey: ["project-budget", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/budget`),
    enabled: hasProject,
  });

  const { data: scheduleData } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/schedule`),
    enabled: hasProject,
  });

  const scenes = (scheduleData?.scenes ?? []) as Array<{ id: string; number: string; heading: string | null }>;
  const shootDays = (scheduleData?.shootDays ?? []) as Array<{ id: string; date: string; status: string }>;
  const budgetLines = (expensesData?.budgetLines ?? []) as Array<{ id: string; department: string | null; name: string; total: number }>;

  const expenses = useMemo(() => (expensesData?.expenses ?? []) as ExpenseRow[], [expensesData?.expenses]);
  const dashboard = expensesData?.dashboard ?? {};
  const alerts = (expensesData?.alerts ?? []) as Array<{ type: string; severity: string; message: string }>;
  const cashFlowTimeline = (expensesData?.cashFlowTimeline ?? []) as Array<{ date: string; amount: number; cumulative: number }>;
  const comparison = expensesData?.comparison ?? {};

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        if (categoryFilter && e.meta.category.toUpperCase() !== categoryFilter) return false;
        if (approvalFilter && e.meta.approvalStatus !== approvalFilter) return false;
        if (paymentFilter && e.meta.paymentStatus !== paymentFilter) return false;
        return true;
      }),
    [expenses, categoryFilter, approvalFilter, paymentFilter],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] });
    void queryClient.invalidateQueries({ queryKey: ["project-budget", projectId] });
  };

  const createMutation = useMutation({
    mutationFn: async (forceCreate?: boolean) => {
      const res = await fetch(`/api/creator/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          budgetLineId: form.budgetLineId || null,
          sceneId: form.sceneId || null,
          shootDayId: form.shootDayId || null,
          amount: Number(form.amount),
          vendor: form.vendor || null,
          paymentMethod: form.paymentMethod,
          notes: form.notes || null,
          fundingSource: form.fundingSource || null,
          paymentDueAt: form.paymentDueAt ? new Date(form.paymentDueAt).toISOString() : null,
          receiptUrls,
          paymentProofUrls,
          approvalStatus: "PENDING",
          paymentStatus: "UNPAID",
          spentAt: new Date().toISOString(),
          receiptNumber: ocrPreview?.receiptNumber?.value ?? null,
          vatAmount: ocrPreview?.vatAmount?.value ?? null,
          ocrConfidence: ocrPreview?.amount?.confidence ?? null,
          ocrRawText: ocrRawText ?? null,
          forceCreate: forceCreate === true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create expense");
      return json as { duplicateWarnings?: Array<{ id: string; title: string; amount: number }> };
    },
    onSuccess: (data) => {
      invalidate();
      if (data.duplicateWarnings?.length) {
        setToast(`Expense logged — ${data.duplicateWarnings.length} possible duplicate(s) flagged.`);
      } else {
        setToast("Expense logged and linked to budget.");
      }
      resetForm();
    },
    onError: (e) => {
      if (projectId && typeof navigator !== "undefined" && !navigator.onLine) {
        queueOfflineExpense(projectId, {
          title: form.title,
          category: form.category,
          amount: Number(form.amount),
          vendor: form.vendor || null,
          paymentMethod: form.paymentMethod,
          receiptUrls,
          ocrRawText: ocrRawText ?? null,
        });
        setToast("Saved offline — will sync when connection returns.");
        resetForm();
        return;
      }
      setToast((e as Error).message);
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/creator/projects/${projectId}/expenses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update expense");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setToast("Expense updated.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/expenses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to archive expense");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setToast("Expense archived.");
    },
    onError: (e) => setToast((e as Error).message),
  });

  const autoCaptureMutation = useMutation({
    mutationFn: async (source: "SIGNED_CONTRACTS" | "EQUIPMENT_USAGE") => {
      const res = await fetch(`/api/creator/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "AUTO_CAPTURE", autoSource: source }),
      });
      if (!res.ok) throw new Error("Auto-capture failed");
      return res.json();
    },
    onSuccess: (data: { createdCount?: number; skippedCount?: number }) => {
      invalidate();
      setToast(`Captured ${data.createdCount ?? 0} expense(s)${data.skippedCount ? `, skipped ${data.skippedCount} duplicate(s)` : ""}.`);
    },
    onError: (e) => setToast((e as Error).message),
  });

  const resetForm = () => {
    setForm({
      title: "",
      category: "MISCELLANEOUS",
      budgetLineId: "",
      sceneId: "",
      shootDayId: "",
      amount: "",
      vendor: "",
      paymentMethod: "OTHER",
      notes: "",
      fundingSource: "",
      paymentDueAt: "",
    });
    setReceiptUrls([]);
    setPaymentProofUrls([]);
    setOcrPreview(null);
    setOcrRawText(null);
  };

  const uploadFile = useCallback(
    async (file: File, type: "receipt" | "proof") => {
      if (type === "receipt") setReceiptUploading(true);
      try {
        const publicUrl = await uploadContentMediaViaApi(file);
        if (type === "receipt") {
          setReceiptUrls((prev) => [...prev, publicUrl]);
          const parseRes = await fetch(`/api/creator/projects/${projectId}/expenses/vision-ocr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: publicUrl,
              fileName: file.name,
              hintVendor: form.vendor || undefined,
            }),
          });
          if (parseRes.ok) {
            const parsed = await parseRes.json();
            setOcrPreview(parsed.fields ?? null);
            setOcrRawText(typeof parsed.ocrText === "string" ? parsed.ocrText : null);
            if (parsed.fields?.vendor?.value && !form.vendor) {
              setForm((p) => ({ ...p, vendor: String(parsed.fields.vendor.value) }));
            }
            if (parsed.fields?.amount?.value && !form.amount) {
              setForm((p) => ({ ...p, amount: String(parsed.fields.amount.value) }));
            }
            if (parsed.fields?.spentAt?.value && !form.title) {
              setForm((p) => ({ ...p, title: `Receipt ${file.name.replace(/\.[^.]+$/, "")}` }));
            }
          }
        } else {
          setPaymentProofUrls((prev) => [...prev, publicUrl]);
        }
      } finally {
        if (type === "receipt") setReceiptUploading(false);
      }
    },
    [projectId, form.vendor, form.amount, form.title],
  );

  const compactMode = deviceClass === "mobile" || (deviceClass === "tablet" && orientation === "portrait");
  const engine = budgetData?.engine as { dashboard?: { estimatedTotal: number; actualSpend: number; variance: number } } | undefined;
  const planned = dashboard.totalBudget ?? engine?.dashboard?.estimatedTotal ?? 0;

  if (!hasProject) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="font-display text-2xl font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">Link a project to access the production finance command center.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="storytime-plan-card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Production finance</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Track what you spend on set, upload receipts, and see how actual costs compare to your budget.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href={`/creator/projects/${projectId}/pre-production/budget-builder`} className="text-orange-400 hover:text-orange-300">
              AI Budget Studio →
            </Link>
            <Link href={`/api/creator/projects/${projectId}/expenses?format=csv`} className="text-slate-400 hover:text-slate-200">
              Export CSV →
            </Link>
          </div>
        </div>
      </header>

      {toast && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200">{toast}</div>
      )}

      <ExpenseStudioNav active={workspace} onChange={setWorkspace} />

      {projectId && <OfflineSyncBanner projectId={projectId} onFlushed={() => queryClient.invalidateQueries({ queryKey: ["project-expenses", projectId] })} />}

      {isLoading ? (
        <Skeleton className="h-48 bg-slate-800/60" />
      ) : (
        <>
          {workspace === "dashboard" && (
            <DashboardView
              dashboard={dashboard}
              planned={planned}
              alerts={alerts}
              cashFlow={cashFlowTimeline}
              compact={compactMode}
              onUploadReceipt={() => setWorkspace("entry")}
            />
          )}

          {workspace === "budget-compare" && (
            <BudgetComparePanel rows={comparison.byDepartment ?? dashboard.comparisonByDepartment ?? []} overall={comparison.overall} />
          )}

          {workspace === "reports" && projectId && <FinancialReportsPanel projectId={projectId} />}
          {workspace === "vendors" && projectId && <VendorsPanel projectId={projectId} />}
          {workspace === "purchase-orders" && projectId && <PurchaseOrdersPanel projectId={projectId} />}
          {workspace === "payroll" && projectId && <PayrollPanel projectId={projectId} />}
          {workspace === "petty-cash" && projectId && <PettyCashPanel projectId={projectId} />}

          {workspace === "entry" && (
            <EntryForm
              form={form}
              setForm={setForm}
              scenes={scenes}
              shootDays={shootDays}
              budgetLines={budgetLines}
              receiptUrls={receiptUrls}
              paymentProofUrls={paymentProofUrls}
              receiptUploading={receiptUploading}
              ocrPreview={ocrPreview}
              onUpload={uploadFile}
              onSubmit={() => createMutation.mutate(false)}
              onForceSubmit={() => createMutation.mutate(true)}
              pending={createMutation.isPending}
              onAutoCapture={(s) => autoCaptureMutation.mutate(s)}
              autoPending={autoCaptureMutation.isPending}
              compact={compactMode}
            />
          )}

          {workspace === "expenses" && (
            <ExpenseList
              projectId={projectId}
              expenses={filteredExpenses}
              categoryFilter={categoryFilter}
              approvalFilter={approvalFilter}
              paymentFilter={paymentFilter}
              onCategoryFilter={setCategoryFilter}
              onApprovalFilter={setApprovalFilter}
              onPaymentFilter={setPaymentFilter}
              onPatch={(p) => patchMutation.mutate(p)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          )}

        </>
      )}
    </div>
  );
}

function DashboardView({
  dashboard,
  planned,
  alerts,
  cashFlow,
  compact,
  onUploadReceipt,
}: {
  dashboard: Record<string, unknown>;
  planned: number;
  alerts: Array<{ message: string }>;
  cashFlow: Array<{ date: string; amount: number; cumulative: number }>;
  compact: boolean;
  onUploadReceipt: () => void;
}) {
  const d = dashboard;
  const kpis = [
    ["Total budget", planned, "text-white"],
    ["Total spent", d.totalSpend, "text-white"],
    ["Remaining", d.remainingBudget, "text-emerald-300"],
    ["Pending approval", d.pendingApprovals, "text-sky-200"],
    ["Missing receipts", d.missingReceipts, "text-amber-200"],
    ["Budget health", `${d.budgetHealthScore ?? 0}%`, Number(d.budgetHealthScore) > 70 ? "text-emerald-300" : "text-amber-300"],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-orange-100">Log a new expense</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Upload a receipt photo or PDF — we&apos;ll scan it and fill in the details.</p>
        </div>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white shrink-0" onClick={onUploadReceipt}>
          <Camera className="h-3.5 w-3.5 mr-1.5" />
          Upload receipt
        </Button>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-200 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Financial alerts
          </p>
          <ul className="space-y-1">
            {alerts.map((a, i) => (
              <li key={i} className="text-xs text-red-50">{a.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "md:grid-cols-3 lg:grid-cols-6"}`}>
        {kpis.map(([label, val, cls]) => (
          <div key={label} className="creator-glass-panel p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-lg font-semibold mt-1 ${cls}`}>
              {typeof val === "number" ? formatZar(val, { maximumFractionDigits: 0 }) : String(val ?? "—")}
            </p>
          </div>
        ))}
      </div>

      {(d.aiInsights as string[] | undefined)?.length ? (
        <div className="creator-glass-panel p-4 border border-orange-500/20 bg-orange-500/5">
          <p className="text-xs font-medium text-orange-200 mb-2 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> AI financial insights
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            {(d.aiInsights as string[]).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Recent spend</p>
          {cashFlow.slice(-7).map((c) => (
            <div key={c.date} className="flex justify-between text-xs rounded bg-slate-900/70 px-2 py-1">
              <span className="text-slate-400">{c.date}</span>
              <span className="text-slate-200">{formatZar(c.amount, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
          {cashFlow.length === 0 ? <p className="text-xs text-slate-500">No spend recorded yet.</p> : null}
        </div>
        <div className="creator-glass-panel p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Upcoming payments</p>
          {((d.upcomingPayments as Array<{ title: string; amount: number; dueAt: string | null }>) ?? []).length === 0 ? (
            <p className="text-xs text-slate-500">No scheduled payments.</p>
          ) : (
            (d.upcomingPayments as Array<{ title: string; amount: number; dueAt: string | null }>).map((p, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-slate-300">{p.title}</span>
                <span className="text-white">{formatZar(p.amount)} {p.dueAt ? `· ${new Date(p.dueAt).toLocaleDateString()}` : ""}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

type ExpenseFormState = {
  title: string;
  category: string;
  budgetLineId: string;
  sceneId: string;
  shootDayId: string;
  amount: string;
  vendor: string;
  paymentMethod: string;
  notes: string;
  fundingSource: string;
  paymentDueAt: string;
};

function EntryForm({
  form,
  setForm,
  scenes,
  shootDays,
  budgetLines,
  receiptUrls,
  paymentProofUrls,
  receiptUploading,
  ocrPreview,
  onUpload,
  onSubmit,
  onForceSubmit,
  pending,
  onAutoCapture,
  autoPending,
  compact,
}: {
  form: ExpenseFormState;
  setForm: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  scenes: Array<{ id: string; number: string }>;
  shootDays: Array<{ id: string; date: string }>;
  budgetLines: Array<{ id: string; name: string; department: string | null }>;
  receiptUrls: string[];
  paymentProofUrls: string[];
  receiptUploading: boolean;
  ocrPreview: Record<string, { value: unknown; confidence: number } | null> | null;
  onUpload: (file: File, type: "receipt" | "proof") => Promise<void>;
  onSubmit: () => void;
  onForceSubmit: () => void;
  pending: boolean;
  onAutoCapture: (s: "SIGNED_CONTRACTS" | "EQUIPMENT_USAGE") => void;
  autoPending: boolean;
  compact: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="creator-glass-panel p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-white">Upload receipt</p>
        <p className="text-[11px] text-slate-400 mt-1">Take a photo or upload a PDF. We&apos;ll read the amount and vendor when possible.</p>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 px-6 py-8 cursor-pointer hover:border-orange-500/40 hover:bg-slate-900/50 transition">
        <Camera className="h-8 w-8 text-orange-400/80" />
        <span className="text-sm font-medium text-slate-200">
          {receiptUploading ? "Scanning receipt…" : "Tap to upload receipt"}
        </span>
        <span className="text-[11px] text-slate-500">Image or PDF</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await onUpload(f, "receipt");
            e.currentTarget.value = "";
          }}
        />
      </label>

      {receiptUrls.length > 0 ? (
        <p className="text-[11px] text-emerald-300">{receiptUrls.length} receipt file(s) attached</p>
      ) : null}

      {ocrPreview && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-[11px] text-sky-100">
          Scanned from receipt — check these before saving:
          <div className="mt-1 flex flex-wrap gap-2 text-slate-400">
            {Object.entries(ocrPreview).map(([k, v]) =>
              v ? (
                <span key={k}>{k}: {String(v.value)}</span>
              ) : null,
            )}
          </div>
        </div>
      )}

      <div className={`grid gap-2 ${compact ? "" : "md:grid-cols-2"}`}>
        <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="What was this for?" className="bg-slate-900 border-slate-700 text-sm" />
        <Input value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Amount (R)" type="number" className="bg-slate-900 border-slate-700 text-sm" />
        <Input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="Vendor / supplier" className="bg-slate-900 border-slate-700 text-sm" />
        <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="h-10 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-white">
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={!form.title.trim() || !form.amount || pending} onClick={onSubmit}>
          Save expense
        </Button>
        <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200">
          <Receipt className="h-3.5 w-3.5 mr-1" />
          Payment proof
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await onUpload(f, "proof");
            e.currentTarget.value = "";
          }} />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[11px] text-slate-500 hover:text-slate-300"
      >
        {showAdvanced ? "Hide" : "Show"} more options (budget line, scene, shoot day…)
      </button>

      {showAdvanced ? (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <div className={`grid gap-2 ${compact ? "" : "md:grid-cols-3"}`}>
            <select value={form.budgetLineId} onChange={(e) => setForm((p) => ({ ...p, budgetLineId: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
              <option value="">Link budget line (optional)</option>
              {budgetLines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select value={form.sceneId} onChange={(e) => setForm((p) => ({ ...p, sceneId: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
              <option value="">Scene (optional)</option>
              {scenes.map((s) => <option key={s.id} value={s.id}>Scene {s.number}</option>)}
            </select>
            <select value={form.shootDayId} onChange={(e) => setForm((p) => ({ ...p, shootDayId: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
              <option value="">Shoot day</option>
              {shootDays.map((d) => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div className={`grid gap-2 ${compact ? "" : "md:grid-cols-2"}`}>
            <select value={form.paymentMethod} onChange={(e) => setForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
              {["CASH", "PETTY_CASH", "CARD", "CREDIT_CARD", "TRANSFER", "MOBILE", "OTHER"].map((m) => (
                <option key={m} value={m}>{m.replaceAll("_", " ")}</option>
              ))}
            </select>
            <Input type="date" value={form.paymentDueAt} onChange={(e) => setForm((p) => ({ ...p, paymentDueAt: e.target.value }))} className="bg-slate-900 border-slate-700 text-xs" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-amber-600/50 text-amber-200 text-xs" disabled={pending} onClick={onForceSubmit}>
              Save anyway (ignore duplicates)
            </Button>
            <Button size="sm" variant="outline" className="border-slate-700 text-xs" disabled={autoPending} onClick={() => onAutoCapture("SIGNED_CONTRACTS")}>
              Import from contracts
            </Button>
            <Button size="sm" variant="outline" className="border-slate-700 text-xs" disabled={autoPending} onClick={() => onAutoCapture("EQUIPMENT_USAGE")}>
              Import from equipment
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExpenseList({
  projectId,
  expenses,
  categoryFilter,
  approvalFilter,
  paymentFilter,
  onCategoryFilter,
  onApprovalFilter,
  onPaymentFilter,
  onPatch,
  onDelete,
}: {
  projectId: string;
  expenses: ExpenseRow[];
  categoryFilter: string;
  approvalFilter: string;
  paymentFilter: string;
  onCategoryFilter: (v: string) => void;
  onApprovalFilter: (v: string) => void;
  onPaymentFilter: (v: string) => void;
  onPatch: (p: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
          <select value={categoryFilter} onChange={(e) => onCategoryFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
          <select value={approvalFilter} onChange={(e) => onApprovalFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All approvals</option>
            {["PENDING", "APPROVED", "REJECTED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={paymentFilter} onChange={(e) => onPaymentFilter(e.target.value)} className="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-white">
            <option value="">All payments</option>
            {["UNPAID", "PARTIAL", "PAID"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
      </div>

      <div className="creator-glass-panel p-3 space-y-2 max-h-[32rem] overflow-y-auto">
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No expenses in this view.</p>
        ) : (
          expenses.map((e) => {
            const expanded = selectedId === e.id;
            return (
            <div key={e.id} className={`rounded-lg border px-3 py-2 text-sm ${e.meta.duplicateOfId ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-900/80"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button type="button" className="text-slate-200 font-medium hover:underline text-left" onClick={() => setSelectedId(expanded ? null : e.id)}>
                    {e.meta.title}
                  </button>
                  {e.meta.duplicateOfId && (
                    <span className="ml-2 text-[10px] text-amber-300">Possible duplicate</span>
                  )}
                </div>
                <span className="text-white font-medium">{formatZar(e.amount)}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {categoryLabel(e.meta.category)} · {e.vendor ?? "—"} · {new Date(e.spentAt).toLocaleString()}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {e.meta.receiptUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:underline">
                    Receipt
                  </a>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-slate-700" onClick={() => onPatch({ id: e.id, meta: { approvalStatus: "APPROVED" } })}>Approve</Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-slate-700" onClick={() => onPatch({ id: e.id, meta: { paymentStatus: "PAID" } })}>Mark paid</Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-slate-700" onClick={() => setSelectedId(expanded ? null : e.id)}>
                  {expanded ? "Hide" : "Details"}
                </Button>
                <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] border-rose-700 text-rose-200" onClick={() => onDelete(e.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {expanded && (
                <div className="mt-3 border-t border-slate-800 pt-3 space-y-3">
                  <FinanceApprovalPanel projectId={projectId} entityType="EXPENSE" entityId={e.id} />
                  {e.meta.ocrRawText && (
                    <details className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-[10px] text-slate-400">
                      <summary className="cursor-pointer text-slate-300">Receipt OCR text</summary>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{e.meta.ocrRawText}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
