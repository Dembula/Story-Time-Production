"use client";

import { useEffect, useState } from "react";

type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  kind: string;
  amount: number | null;
  target: string;
  active: boolean;
  maxRedemptions: number | null;
  redemptionsCount: number;
  expiresAt: string | null;
  redemptions?: Array<{
    id: string;
    context: string;
    referenceId: string | null;
    discountAmount: number | null;
    resultingPlan: string | null;
    redeemedAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
    };
  }>;
};

const PROMO_KINDS = [
  { id: "DISCOUNT_PERCENT", label: "Discount (%)" },
  { id: "DISCOUNT_FIXED", label: "Discount (fixed)" },
  { id: "FREE_YEAR_SUBSCRIPTION", label: "Free year subscription" },
];

const PROMO_TARGETS = [
  { id: "VIEWER_SUBSCRIPTION", label: "Viewer subscription" },
  { id: "CREATOR_LICENSE", label: "Creator license" },
  { id: "ANY", label: "Any package" },
];

export function AdminPromoCodesClient() {
  const [items, setItems] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedPromoId, setExpandedPromoId] = useState<string | null>(null);
  const [exportCode, setExportCode] = useState("");
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");

  function toLocalInputValue(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function applyPreset(range: "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS") {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    if (range === "TODAY") {
      start.setHours(0, 0, 0, 0);
    } else if (range === "LAST_7_DAYS") {
      start.setDate(start.getDate() - 7);
    } else {
      start.setDate(start.getDate() - 30);
    }
    setExportStart(toLocalInputValue(start));
    setExportEnd(toLocalInputValue(end));
  }
  const [form, setForm] = useState({
    code: "",
    description: "",
    kind: "DISCOUNT_PERCENT",
    amount: "10",
    target: "VIEWER_SUBSCRIPTION",
    maxRedemptions: "",
    expiresAt: "",
  });

  useEffect(() => {
    fetch("/api/admin/promo-codes")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function createPromoCode() {
    setSaving(true);
    const res = await fetch("/api/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        description: form.description,
        kind: form.kind,
        amount: form.kind === "FREE_YEAR_SUBSCRIPTION" ? undefined : Number.parseFloat(form.amount),
        target: form.target,
        maxRedemptions: form.maxRedemptions ? Number.parseInt(form.maxRedemptions, 10) : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setItems((prev) => [data, ...prev]);
      setForm({
        code: "",
        description: "",
        kind: "DISCOUNT_PERCENT",
        amount: "10",
        target: "VIEWER_SUBSCRIPTION",
        maxRedemptions: "",
        expiresAt: "",
      });
    }
    setSaving(false);
  }

  async function togglePromoCode(id: string, active: boolean) {
    const res = await fetch("/api/admin/promo-codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    const updated = await res.json();
    if (res.ok) setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
  }

  async function exportCsv() {
    const params = new URLSearchParams();
    if (exportCode.trim()) params.set("code", exportCode.trim().toUpperCase());
    if (exportStart) params.set("start", new Date(exportStart).toISOString());
    if (exportEnd) params.set("end", new Date(exportEnd).toISOString());

    const res = await fetch(`/api/admin/promo-codes/export?${params.toString()}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "promo-redemptions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-8 text-slate-400">Loading promo codes...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Promo Codes</h1>
        <p className="text-slate-400 mt-1">Generate access and discount codes for viewer/creator package onboarding.</p>
      </div>

      <div className="storytime-section p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="Promo code" className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        <select value={form.kind} onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))} className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
          {PROMO_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <select value={form.target} onChange={(e) => setForm((prev) => ({ ...prev, target: e.target.value }))} className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
          {PROMO_TARGETS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        {form.kind !== "FREE_YEAR_SUBSCRIPTION" ? (
          <input value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Amount" className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        ) : <div />}
        <input value={form.maxRedemptions} onChange={(e) => setForm((prev) => ({ ...prev, maxRedemptions: e.target.value }))} placeholder="Max redemptions (optional)" className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description (optional)" className="md:col-span-2 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        <button onClick={createPromoCode} disabled={saving || !form.code.trim()} className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition disabled:opacity-50">Create promo code</button>
      </div>

      <div className="storytime-section p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input value={exportCode} onChange={(e) => setExportCode(e.target.value)} placeholder="Filter code (optional)" className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        <input type="datetime-local" value={exportStart} onChange={(e) => setExportStart(e.target.value)} className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        <input type="datetime-local" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
        <button onClick={exportCsv} className="px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition">Export redemptions CSV</button>
        <div className="md:col-span-4 flex flex-wrap gap-2">
          <button onClick={() => applyPreset("TODAY")} className="px-3 py-1.5 text-xs rounded bg-slate-700/70 text-slate-200 hover:bg-slate-600/70">Today</button>
          <button onClick={() => applyPreset("LAST_7_DAYS")} className="px-3 py-1.5 text-xs rounded bg-slate-700/70 text-slate-200 hover:bg-slate-600/70">Last 7 days</button>
          <button onClick={() => applyPreset("LAST_30_DAYS")} className="px-3 py-1.5 text-xs rounded bg-slate-700/70 text-slate-200 hover:bg-slate-600/70">Last 30 days</button>
          <button onClick={() => { setExportStart(""); setExportEnd(""); }} className="px-3 py-1.5 text-xs rounded bg-slate-800 text-slate-400 hover:bg-slate-700">Clear dates</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="storytime-section p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-medium">{item.code}</p>
                <p className="text-xs text-slate-400">{item.kind} · {item.target} · used {item.redemptionsCount}{item.maxRedemptions ? `/${item.maxRedemptions}` : ""}</p>
                {item.description ? <p className="text-xs text-slate-500 mt-1">{item.description}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setExpandedPromoId((prev) => (prev === item.id ? null : item.id))} className="px-3 py-2 rounded-lg text-sm bg-slate-700/60 text-slate-200 hover:bg-slate-600/60">
                  {expandedPromoId === item.id ? "Hide usage" : "View usage"}
                </button>
                <button onClick={() => togglePromoCode(item.id, !item.active)} className={`px-3 py-2 rounded-lg text-sm ${item.active ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                  {item.active ? "Disable" : "Enable"}
                </button>
              </div>
            </div>

            {expandedPromoId === item.id ? (
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Recent redemptions</p>
                {item.redemptions && item.redemptions.length > 0 ? (
                  item.redemptions.map((redeem) => (
                    <div key={redeem.id} className="text-xs text-slate-300 border border-slate-800 rounded-lg p-2 bg-slate-950/40">
                      <p className="text-slate-200 font-medium">{redeem.user?.name || "User"} · {redeem.user?.email || "No email"}</p>
                      <p className="text-slate-400 mt-0.5">
                        {redeem.context} · {redeem.resultingPlan || "N/A"} · discount R{(redeem.discountAmount ?? 0).toFixed(2)}
                      </p>
                      <p className="text-slate-500 mt-0.5">{new Date(redeem.redeemedAt).toLocaleString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No redemptions yet.</p>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
