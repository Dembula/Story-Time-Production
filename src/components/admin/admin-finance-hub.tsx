"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPayoutRequestsPanel } from "@/components/admin/admin-payout-requests-panel";
import { AdminTransactionDetailModal } from "@/components/admin/admin-transaction-detail-modal";
import {
  FINANCE_PERIOD_OPTIONS,
  type FinancePeriodKey,
} from "@/lib/finance/period-range";
import type { FinanceOverviewBundle, FinanceSheetRow } from "@/lib/finance/overview-bundle";

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

const pct = (rate: number) => `${(rate * 100).toFixed(rate >= 0.1 ? 2 : 4)}%`;

type TabId =
  | "overview"
  | "sheets"
  | "promo"
  | "funding"
  | "retention"
  | "gateways"
  | "payouts"
  | "settings"
  | "exports";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "sheets", label: "Transactions" },
  { id: "promo", label: "Promo liability" },
  { id: "funding", label: "Funding portal" },
  { id: "retention", label: "Retention & treasury" },
  { id: "gateways", label: "Gateways & fees" },
  { id: "payouts", label: "Payouts" },
  { id: "settings", label: "Fee settings" },
  { id: "exports", label: "Exports" },
];

function readInitialTab(): TabId {
  if (typeof window === "undefined") return "overview";
  const q = new URLSearchParams(window.location.search).get("tab");
  if (q === "sheets") return "sheets";
  if (q && TABS.some((t) => t.id === q)) return q as TabId;
  return "overview";
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function AdminFinanceHub() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>(readInitialTab);
  const [period, setPeriod] = useState<FinancePeriodKey>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sheetFilter, setSheetFilter] = useState<"all" | "payment" | "marketplace">("all");
  const [sheetSearch, setSheetSearch] = useState("");
  const [detail, setDetail] = useState<{ kind: "payment" | "marketplace"; id: string } | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    appleCommissionRatePct: "",
    viewerCreatorSplitPct: "",
    viewerPlatformSplitPct: "",
    marketplaceFeeRatePct: "",
    note: "",
  });
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [distributeMsg, setDistributeMsg] = useState<string | null>(null);

  const queryPeriod = period === "custom" ? "custom" : period;
  const overviewQuery = useQuery({
    queryKey: ["admin-finance-overview", queryPeriod, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period: queryPeriod, limit: "300" });
      if (queryPeriod === "custom") {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
      }
      const res = await fetch(`/api/admin/finance/overview?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load finance overview");
      return json as FinanceOverviewBundle;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["admin-finance-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/finance/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load settings");
      return json as {
        settings: {
          appleCommissionRate: number;
          viewerCreatorSplit: number;
          viewerPlatformSplit: number;
          marketplaceFeeRate: number;
          note: string | null;
          updatedAt: string | null;
        };
        history: Array<{
          id: string;
          appleCommissionRate: number;
          viewerCreatorSplit: number;
          viewerPlatformSplit: number;
          marketplaceFeeRate: number;
          note: string | null;
          createdAt: string;
        }>;
      };
    },
  });

  const bundle = overviewQuery.data;

  useEffect(() => {
    const s = settingsQuery.data?.settings;
    if (!s) return;
    setSettingsForm((prev) => {
      if (prev.appleCommissionRatePct) return prev;
      return {
        appleCommissionRatePct: String(roundPct(s.appleCommissionRate)),
        viewerCreatorSplitPct: String(roundPct(s.viewerCreatorSplit)),
        viewerPlatformSplitPct: String(roundPct(s.viewerPlatformSplit)),
        marketplaceFeeRatePct: String(roundPct(s.marketplaceFeeRate)),
        note: s.note ?? "",
      };
    });
  }, [settingsQuery.data?.settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const body = {
        appleCommissionRate: Number(settingsForm.appleCommissionRatePct) / 100,
        viewerCreatorSplit: Number(settingsForm.viewerCreatorSplitPct) / 100,
        viewerPlatformSplit: Number(settingsForm.viewerPlatformSplitPct) / 100,
        marketplaceFeeRate: Number(settingsForm.marketplaceFeeRatePct) / 100,
        note: settingsForm.note || null,
      };
      const res = await fetch("/api/admin/finance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      return json;
    },
    onSuccess: async () => {
      setSettingsMsg("Fee settings saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-finance-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-finance-overview"] }),
      ]);
    },
    onError: (err: Error) => setSettingsMsg(err.message),
  });

  const distributePool = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/revenue/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Distribute failed");
      return json;
    },
    onSuccess: (json) => {
      setDistributeMsg(
        json.skipped
          ? `Skipped: ${json.reason || "already done"} (${json.periodKey || ""})`
          : `Distributed creator pool for ${json.periodKey || "previous month"}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-finance-overview"] });
    },
    onError: (err: Error) => setDistributeMsg(err.message),
  });

  function selectTab(next: TabId) {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState({}, "", url.toString());
    }
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ period: queryPeriod, format: "csv" });
    if (queryPeriod === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    return `/api/admin/finance/export?${params}`;
  }, [queryPeriod, customFrom, customTo]);

  const sheetRows = useMemo(() => {
    if (!bundle) return [] as FinanceSheetRow[];
    const merged = [
      ...(sheetFilter !== "marketplace" ? bundle.sheets : []),
      ...(sheetFilter !== "payment" ? bundle.marketplaceSheets || [] : []),
    ].sort((a, b) => String(b.paidAt || "").localeCompare(String(a.paidAt || "")));
    const needle = sheetSearch.trim().toLowerCase();
    if (!needle) return merged;
    return merged.filter((r) => {
      const hay = [
        r.id,
        r.purpose,
        r.purposeLabel,
        r.provider,
        r.payer?.name,
        r.payer?.email,
        r.payee?.name,
        r.payee?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [bundle, sheetFilter, sheetSearch]);

  return (
    <div className="space-y-6 text-slate-100">
      <header className="storytime-plan-card p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-white">Finance hub</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Period cash, gateway fees, platform retention, promo giveaways, institutional funding, escrow/treasury, and
          full transaction dossiers — everything finance needs in one place.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Period
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              value={period}
              onChange={(e) => setPeriod(e.target.value as FinancePeriodKey)}
            >
              {FINANCE_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
              <option value="custom">Custom range</option>
            </select>
          </label>
          {period === "custom" ? (
            <>
              <label className="text-xs text-slate-400">
                From
                <input
                  type="date"
                  className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="text-xs text-slate-400">
                To
                <input
                  type="date"
                  className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
            </>
          ) : null}
          {bundle ? (
            <p className="pb-2 text-xs text-slate-500">
              {bundle.period.label}: {new Date(bundle.period.periodStart).toLocaleDateString()} →{" "}
              {new Date(bundle.period.periodEnd).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                tab === t.id
                  ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {overviewQuery.isLoading ? <p className="text-sm text-slate-400">Loading finance data…</p> : null}
      {overviewQuery.error ? (
        <p className="text-sm text-rose-300">{(overviewQuery.error as Error).message}</p>
      ) : null}

      {tab === "overview" && bundle ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Gross cash inflow"
              value={money.format(bundle.totals.gross)}
              hint={`${bundle.totals.paymentCount} gateway payments`}
            />
            <Kpi label="Gateway fees" value={money.format(bundle.totals.gatewayFees)} hint="PayFast + Apple" />
            <Kpi label="Net settlement" value={money.format(bundle.totals.net)} hint="Cash after gateway cuts" />
            <Kpi
              label="Platform total retained"
              value={money.format(bundle.totals.platformTotalRetained)}
              hint="Viewer split + service + marketplace fees"
            />
            <Kpi
              label="Viewer pool → creators"
              value={money.format(bundle.totals.creatorPool)}
              hint={`${pct(bundle.feeSettings.viewerCreatorSplit)} of viewer net`}
            />
            <Kpi
              label="Viewer pool → platform"
              value={money.format(bundle.totals.platformRetained)}
              hint={`${pct(bundle.feeSettings.viewerPlatformSplit)} of viewer net`}
            />
            <Kpi
              label="Platform service revenue"
              value={money.format(bundle.totals.platformServiceRevenue)}
              hint="Licences, company subs, uploads, reviews"
            />
            <Kpi
              label="Marketplace fees"
              value={money.format(bundle.totals.marketplaceFees)}
              hint={`Volume ${money.format(bundle.totals.marketplaceVolume)}`}
            />
            <Kpi
              label="Promo liability"
              value={money.format(bundle.totals.promoLiabilityZar)}
              hint={`${bundle.promo.redemptionCount} redemptions · forgone list price`}
            />
            <Kpi
              label="Funding settled"
              value={money.format(bundle.totals.fundingSettledZar)}
              hint={`${bundle.funding.dealPayments.settledCount} deal payments`}
            />
            <Kpi
              label="Payouts paid (period)"
              value={money.format(bundle.payouts.paidAmount)}
              hint={`${bundle.payouts.paidCount} paid`}
            />
            <Kpi
              label="Payouts pending (queue)"
              value={money.format(bundle.payouts.pendingAmount)}
              hint={`${bundle.payouts.pendingCount} open · all-time queue`}
            />
          </div>

          <div className="storytime-plan-card overflow-x-auto p-4">
            <h2 className="text-sm font-semibold text-white">By provider</h2>
            <table className="mt-3 w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Provider</th>
                  <th>Count</th>
                  <th>Gross</th>
                  <th>Fees</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {bundle.byProvider.map((row) => (
                  <tr key={row.provider} className="border-t border-white/5">
                    <td className="py-2 font-medium text-white">{row.provider}</td>
                    <td>{row.count}</td>
                    <td>{money.format(row.gross)}</td>
                    <td>{money.format(row.fees)}</td>
                    <td>{money.format(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bundle.series.length > 0 ? (
            <div className="storytime-plan-card p-4">
              <h2 className="text-sm font-semibold text-white">Daily net settlement</h2>
              <div className="mt-3 flex h-24 items-end gap-1">
                {bundle.series.map((d) => {
                  const max = Math.max(...bundle.series.map((x) => x.net), 1);
                  const h = Math.max(4, Math.round((d.net / max) * 100));
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${money.format(d.net)}`}
                      className="flex-1 rounded-t bg-amber-500/50"
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "sheets" && bundle ? (
        <section className="space-y-4">
          <div className="storytime-plan-card space-y-3 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Transaction dossier sheet</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Click any row for payer, payee, fees, gateway refs, and revenue routing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "payment", "marketplace"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSheetFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs capitalize ${
                      sheetFilter === f ? "bg-amber-500/20 text-amber-100" : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <input
                  value={sheetSearch}
                  onChange={(e) => setSheetSearch(e.target.value)}
                  placeholder="Search payer, purpose, id…"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">When</th>
                    <th>Kind</th>
                    <th>Paid by</th>
                    <th>Paid to</th>
                    <th>Purpose</th>
                    <th>Gross</th>
                    <th>Fee</th>
                    <th>Net</th>
                    <th>Platform</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetRows.map((row) => (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                      onClick={() => setDetail({ kind: row.kind, id: row.id })}
                    >
                      <td className="whitespace-nowrap py-2 text-slate-300">
                        {row.paidAt ? new Date(row.paidAt).toLocaleString() : "—"}
                      </td>
                      <td className="capitalize text-slate-400">{row.kind}</td>
                      <td className="max-w-[160px] truncate" title={row.payer.email || ""}>
                        {row.payer.name || row.payer.email || "—"}
                      </td>
                      <td className="max-w-[160px] truncate">
                        {row.payee ? row.payee.name || row.payee.email || "—" : "Story Time"}
                      </td>
                      <td className="max-w-[200px] truncate" title={row.purpose}>
                        {row.purposeLabel || row.purpose}
                      </td>
                      <td>{money.format(row.gross)}</td>
                      <td>{money.format(row.gatewayFee)}</td>
                      <td>{money.format(row.net)}</td>
                      <td>{money.format(row.platformShare)}</td>
                      <td className="text-slate-400">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sheetRows.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No rows match.</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "promo" && bundle ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Discount liability" value={money.format(bundle.promo.totalDiscountZar)} hint="Forgone list-price ZAR" />
            <Kpi label="Redemptions" value={String(bundle.promo.redemptionCount)} />
            <Kpi label="Free-year grants" value={String(bundle.promo.freeYearCount)} />
            <Kpi
              label="vs cash gross"
              value={
                bundle.promo.insight.discountAsPctOfGross != null
                  ? `${bundle.promo.insight.discountAsPctOfGross}%`
                  : "—"
              }
              hint={bundle.promo.insight.note}
            />
          </div>
          <p className="text-sm text-slate-400">{bundle.promo.insight.note}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="storytime-plan-card overflow-x-auto p-4">
              <h2 className="text-sm font-semibold text-white">By promo code</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Code</th>
                    <th>Kind</th>
                    <th>Uses</th>
                    <th>Liability</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.promo.byCode.map((c) => (
                    <tr key={c.code} className="border-t border-white/5">
                      <td className="py-2 font-medium text-white">{c.code}</td>
                      <td className="text-slate-400">{c.kind}</td>
                      <td>
                        {c.redemptionCount}
                        {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                      </td>
                      <td>{money.format(c.discountZar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bundle.promo.byCode.length === 0 ? <p className="mt-3 text-sm text-slate-500">No redemptions in period.</p> : null}
            </div>
            <div className="storytime-plan-card overflow-x-auto p-4">
              <h2 className="text-sm font-semibold text-white">By context</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Context</th>
                    <th>Count</th>
                    <th>Liability</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.promo.byContext.map((c) => (
                    <tr key={c.context} className="border-t border-white/5">
                      <td className="py-2">{c.context}</td>
                      <td>{c.count}</td>
                      <td>{money.format(c.discountZar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="storytime-plan-card overflow-x-auto p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Recent redemptions</h2>
              <Link href="/admin/promo-codes" className="text-xs text-amber-300 hover:underline">
                Manage codes
              </Link>
            </div>
            <table className="mt-3 w-full min-w-[800px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">When</th>
                  <th>Code</th>
                  <th>User</th>
                  <th>Context</th>
                  <th>Plan</th>
                  <th>Discount</th>
                </tr>
              </thead>
              <tbody>
                {bundle.promo.recent.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="whitespace-nowrap py-2 text-slate-400">
                      {new Date(r.redeemedAt).toLocaleString()}
                    </td>
                    <td className="text-white">{r.code}</td>
                    <td>{r.user.name || r.user.email}</td>
                    <td className="text-slate-400">{r.context}</td>
                    <td>{r.resultingPlan || "—"}</td>
                    <td>{money.format(r.discountAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "funding" && bundle ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Active programs" value={String(bundle.funding.programsActive)} />
            <Kpi
              label="Settled deal cash"
              value={money.format(bundle.funding.dealPayments.settledZar)}
              hint={`${bundle.funding.dealPayments.settledCount} settled`}
            />
            <Kpi
              label="Pending deal cash"
              value={money.format(bundle.funding.dealPayments.pendingZar)}
              hint="Authorized / locked / pending"
            />
            <Kpi
              label="Agreed term sheets"
              value={money.format(bundle.funding.deals.termSheetCommittedZar)}
              hint={`${bundle.funding.deals.funded} funded · ${bundle.funding.deals.negotiating} in pipeline`}
            />
            <Kpi
              label="Program apps requested"
              value={money.format(bundle.funding.applications.requestedZar)}
              hint={`${bundle.funding.applications.approved} approved · ${money.format(bundle.funding.applications.approvedRequestedZar)}`}
            />
            <Kpi
              label="Project funding asks"
              value={money.format(bundle.funding.projectFundingRequests.requestedZar)}
              hint={`${bundle.funding.projectFundingRequests.pending} pending`}
            />
            <Kpi
              label="Funders approved"
              value={String(bundle.funding.funders.approved)}
              hint={`${bundle.funding.funders.pending} pending KYC`}
            />
            <Kpi label="Deals in period" value={String(bundle.funding.deals.total)} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href="/admin/funding-programs" className="text-amber-300 hover:underline">
              Funding programs
            </Link>
            <Link href="/admin/funders" className="text-amber-300 hover:underline">
              Funder KYC
            </Link>
          </div>
          <div className="storytime-plan-card overflow-x-auto p-4">
            <h2 className="text-sm font-semibold text-white">Deal payments (period)</h2>
            <table className="mt-3 w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">When</th>
                  <th>Project</th>
                  <th>Funder</th>
                  <th>Creator</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Settled</th>
                </tr>
              </thead>
              <tbody>
                {bundle.funding.dealPayments.recent.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="whitespace-nowrap py-2 text-slate-400">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td>{p.projectTitle || "—"}</td>
                    <td>{p.funder.name || p.funder.email}</td>
                    <td>{p.creator.name || p.creator.email}</td>
                    <td>{money.format(p.amount)}</td>
                    <td>{p.status}</td>
                    <td className="text-slate-400">
                      {p.settledAt ? new Date(p.settledAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bundle.funding.dealPayments.recent.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No deal payments in this period.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "retention" && bundle ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Total platform retained" value={money.format(bundle.retention.platformTotalRetained)} />
            <Kpi label="From viewer pool" value={money.format(bundle.retention.viewerPlatformRetained)} />
            <Kpi label="Service revenue (net)" value={money.format(bundle.retention.serviceRevenueNet)} />
            <Kpi label="Marketplace fee take" value={money.format(bundle.retention.marketplaceFees)} />
            <Kpi
              label="Escrow held"
              value={money.format(bundle.retention.escrow.heldZar)}
              hint={`${bundle.retention.escrow.heldCount} open`}
            />
            <Kpi label="Escrow released (period)" value={money.format(bundle.retention.escrow.releasedInPeriodZar)} />
            <Kpi
              label="Treasury PLATFORM_REVENUE"
              value={money.format(bundle.retention.treasury.platformRevenueBalance)}
              hint="Live wallet balances"
            />
            <Kpi
              label="Treasury CREATOR_REVENUE"
              value={money.format(bundle.retention.treasury.creatorRevenueBalance)}
            />
          </div>
          <div className="storytime-plan-card overflow-x-auto p-4">
            <h2 className="text-sm font-semibold text-white">Retention by purpose</h2>
            <p className="mt-1 text-xs text-slate-500">
              How cash in this period maps to platform vs creator shares after gateway fees.
            </p>
            <table className="mt-3 w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Purpose</th>
                  <th>Category</th>
                  <th>Count</th>
                  <th>Gross</th>
                  <th>Gateway</th>
                  <th>Net</th>
                  <th>Platform</th>
                  <th>Creator</th>
                </tr>
              </thead>
              <tbody>
                {bundle.retention.byPurpose.map((r) => (
                  <tr key={r.purpose} className="border-t border-white/5">
                    <td className="max-w-[220px] truncate py-2" title={r.purpose}>
                      {r.purposeLabel}
                    </td>
                    <td className="text-slate-400">{r.category}</td>
                    <td>{r.count}</td>
                    <td>{money.format(r.gross)}</td>
                    <td>{money.format(r.gatewayFees)}</td>
                    <td>{money.format(r.net)}</td>
                    <td>{money.format(r.platformShare)}</td>
                    <td>{money.format(r.creatorShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Wallets AVAILABLE" value={money.format(bundle.retention.treasury.walletsAvailable)} />
            <Kpi label="Wallets PENDING" value={money.format(bundle.retention.treasury.walletsPending)} />
            <Kpi label="Wallets LOCKED" value={money.format(bundle.retention.treasury.walletsLocked)} />
          </div>
        </section>
      ) : null}

      {tab === "gateways" && bundle ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="storytime-plan-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">PayFast</h2>
            <Kpi label="ITN fees" value={money.format(bundle.gateways.payfastItnFees)} />
            <Kpi label="Estimated fees" value={money.format(bundle.gateways.payfastEstimatedFees)} />
            <p className="text-xs text-slate-500">Webhook events in period: {bundle.gateways.webhookEventsInPeriod}</p>
          </div>
          <div className="storytime-plan-card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">Apple IAP</h2>
            <Kpi
              label="Estimated commission"
              value={money.format(bundle.gateways.appleEstimatedFees)}
              hint={`Rate ${pct(bundle.feeSettings.appleCommissionRate)} (editable)`}
            />
            <Kpi label="Proceeds-based fees" value={money.format(bundle.gateways.appleProceedsFees)} />
          </div>
          <div className="storytime-plan-card overflow-x-auto p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Settlement sources</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Source</th>
                  <th>Count</th>
                  <th>Fees</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {bundle.bySettlementSource.map((row) => (
                  <tr key={row.source} className="border-t border-white/5">
                    <td className="py-2">{row.source}</td>
                    <td>{row.count}</td>
                    <td>{money.format(row.fees)}</td>
                    <td>{money.format(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "payouts" ? (
        <section className="space-y-4">
          <div className="storytime-plan-card p-4">
            <h2 className="text-sm font-semibold text-white">Creator watch-pool distribution</h2>
            <p className="mt-1 text-xs text-slate-500">
              Previous month ({bundle?.payouts.previousMonthPeriodKey}):{" "}
              {bundle?.payouts.previousMonthPoolDistributed ? "already distributed" : "pending"}
            </p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-400/30 disabled:opacity-50"
              disabled={distributePool.isPending}
              onClick={() => {
                setDistributeMsg(null);
                distributePool.mutate();
              }}
            >
              {distributePool.isPending ? "Distributing…" : "Distribute previous month pool"}
            </button>
            {distributeMsg ? <p className="mt-2 text-xs text-slate-300">{distributeMsg}</p> : null}
          </div>
          <AdminPayoutRequestsPanel />
        </section>
      ) : null}

      {tab === "settings" ? (
        <section className="storytime-plan-card space-y-4 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-white">Editable fee schedule</h2>
          <p className="text-xs text-slate-500">
            Apple commission applies when App Store proceeds are not on the payment. Viewer splits apply to net
            viewer-pool cash after gateway fees. Marketplace fee is the platform take on marketplace volume.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Apple commission %
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={settingsForm.appleCommissionRatePct}
                onChange={(e) => setSettingsForm((s) => ({ ...s, appleCommissionRatePct: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Marketplace fee %
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={settingsForm.marketplaceFeeRatePct}
                onChange={(e) => setSettingsForm((s) => ({ ...s, marketplaceFeeRatePct: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Creator pool %
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={settingsForm.viewerCreatorSplitPct}
                onChange={(e) => setSettingsForm((s) => ({ ...s, viewerCreatorSplitPct: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400">
              Platform retained %
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={settingsForm.viewerPlatformSplitPct}
                onChange={(e) => setSettingsForm((s) => ({ ...s, viewerPlatformSplitPct: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">
              Note
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={settingsForm.note}
                onChange={(e) => setSettingsForm((s) => ({ ...s, note: e.target.value }))}
              />
            </label>
          </div>
          <button
            type="button"
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-100 ring-1 ring-amber-400/30 disabled:opacity-50"
            disabled={saveSettings.isPending}
            onClick={() => {
              setSettingsMsg(null);
              saveSettings.mutate();
            }}
          >
            {saveSettings.isPending ? "Saving…" : "Save fee settings"}
          </button>
          {settingsMsg ? <p className="text-xs text-slate-300">{settingsMsg}</p> : null}

          {settingsQuery.data?.history?.length ? (
            <div className="overflow-x-auto pt-2">
              <h3 className="text-xs font-semibold uppercase text-slate-500">History</h3>
              <table className="mt-2 w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">When</th>
                    <th>Apple %</th>
                    <th>Creator %</th>
                    <th>Platform %</th>
                    <th>Marketplace %</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {settingsQuery.data.history.map((h) => (
                    <tr key={h.id} className="border-t border-white/5">
                      <td className="whitespace-nowrap py-2">{new Date(h.createdAt).toLocaleString()}</td>
                      <td>{pct(h.appleCommissionRate)}</td>
                      <td>{pct(h.viewerCreatorSplit)}</td>
                      <td>{pct(h.viewerPlatformSplit)}</td>
                      <td>{pct(h.marketplaceFeeRate)}</td>
                      <td className="text-slate-400">{h.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "exports" ? (
        <section className="storytime-plan-card space-y-3 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-white">Exports</h2>
          <p className="text-xs text-slate-500">
            CSV includes summary, providers, sheets, promo liability, funding, and retention for the selected period.
          </p>
          <a
            href={exportHref}
            className="inline-flex rounded-lg bg-amber-500/20 px-4 py-2 text-sm text-amber-100 ring-1 ring-amber-400/30"
          >
            Download finance CSV
          </a>
        </section>
      ) : null}

      <AdminTransactionDetailModal
        kind={detail?.kind ?? null}
        id={detail?.id ?? null}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function roundPct(rate: number): number {
  return Math.round(rate * 1000000) / 10000;
}
