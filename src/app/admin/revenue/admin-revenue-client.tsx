"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { useEffect, useState } from "react";
import { formatZar } from "@/lib/format-currency-zar";
import { ADMIN_DASHBOARD_REFETCH_MS } from "@/lib/dashboard-refresh";
import { COMPANY_PLAN_CONFIG, CREATOR_LICENSE_CONFIG, CREATOR_ONBOARDING_PLANS, CREATOR_PER_FILM_UPLOAD_PRICE } from "@/lib/pricing";
import {
  DollarSign, TrendingUp, Users, Film, Music, PieChart, BarChart3,
  ArrowUpRight, ArrowDownRight, Percent, Wallet, Banknote, Building2,
} from "lucide-react";

interface Creator {
  id: string; name: string | null; email: string | null; role: string;
  watchTime: number; share: number; revenue: number;
  contentCount: number; trackCount: number; syncEarnings: number;
}

interface RevenueData {
  reporting?: {
    primaryWindow: { label: string; periodStartIso: string; periodEndIso: string };
    lines: { monthToDate: string[]; allTime: string[]; cumulativeCounts: string[] };
  };
  platform: { revenuePool: number; totalWatchTime: number; platformCut: number; creatorPool: number };
  creators: Creator[];
  syncDeals: { totalDeals: number; totalSyncRevenue: number };
  contentRevenue: { id: string; title: string; type: string; creatorName: string; watchTime: number; share: number; revenue: number }[];
  viewerSub?: { viewerSubRevenue: number; creatorPoolFromSubs: number; storyTimeFromSubs: number };
  transactionFees?: { totalFees: number; totalVolume: number };
  companySubs?: { count: number; revenue: number };
  distributionLicenses?: { yearlyCount: number; perUploadCount: number; revenue: number };
  treasury?: {
    availableBalance: number;
    pendingBalance: number;
    totalEarnings: number;
    previousMonthKey: string;
    previousMonthDistributed: boolean;
  };
}

export function AdminRevenueClient() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "creators" | "content" | "sync" | "financials">("overview");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/admin/revenue")
        .then((r) => r.json())
        .then((payload) => {
          if (!cancelled) setData(payload);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const timer = window.setInterval(load, ADMIN_DASHBOARD_REFETCH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return <StoryTimeLoadingCenter />;

  const p = data?.platform || { revenuePool: 0, totalWatchTime: 0, platformCut: 0, creatorPool: 0 };
  const creators = data?.creators || [];
  const contentRevenue = data?.contentRevenue || [];
  const sync = data?.syncDeals || { totalDeals: 0, totalSyncRevenue: 0 };
  const totalCreatorPayout = creators.reduce((s, c) => s + c.revenue, 0);
  const platformRetained = p.revenuePool - totalCreatorPayout;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><DollarSign className="w-8 h-8 text-orange-500" /> Revenue Intelligence</h1>
        <p className="text-slate-400">Complete financial breakdown in ZAR — platform revenue, creator payouts, sync licensing, and per-content earnings.</p>
        {data?.reporting?.primaryWindow ? (
          <p className="text-xs text-slate-500 mt-3 max-w-3xl leading-relaxed">
            <span className="text-slate-400 font-medium">Reporting periods: </span>
            Most lines use {data.reporting.primaryWindow.label.toLowerCase()} ({new Date(data.reporting.primaryWindow.periodStartIso).toLocaleDateString()}–
            {new Date(data.reporting.primaryWindow.periodEndIso).toLocaleDateString()}). Sync licensing reflects PAID deals created in this same window. Platform user/content counts are cumulative, not month-filtered. See the Story Time Revenue tab for fee and subscription lines.
          </p>
        ) : null}
        {data?.treasury ? (
          <p className="text-xs text-slate-500 mt-2 max-w-3xl leading-relaxed">
            Story Time treasury available: {formatZar(data.treasury.availableBalance)} · Previous month ({data.treasury.previousMonthKey}) pool{" "}
            {data.treasury.previousMonthDistributed ? "distributed to creators" : "pending distribution"} · Refreshes every 5 minutes.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue Pool", value: formatZar(p.revenuePool, { maximumFractionDigits: 0 }), icon: Wallet, color: "text-orange-400", sub: "Monthly allocation" },
          { label: "Creator Payouts", value: formatZar(totalCreatorPayout), icon: Users, color: "text-green-400", sub: `${creators.length} creators` },
          {
            label: "Platform Retained",
            value: formatZar(platformRetained),
            icon: Building2,
            color: "text-blue-400",
            sub: `${p.revenuePool > 0 ? ((platformRetained / p.revenuePool) * 100).toFixed(1) : "0.0"}% margin`,
          },
          { label: "Sync Licensing", value: formatZar(sync.totalSyncRevenue), icon: Music, color: "text-pink-400", sub: `${sync.totalDeals} deals` },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-slate-400">{s.label}</span></div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["overview", "creators", "content", "sync", "financials"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${tab === t ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>{t === "sync" ? "Sync Deals" : t === "financials" ? "Story Time Revenue" : t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-orange-400" /> Revenue Split Breakdown</h3>
            <p className="text-sm text-slate-400 mb-4">
              Viewer subscription revenue splits <strong className="text-slate-300">60% creator pool</strong> /{" "}
              <strong className="text-slate-300">40% Story Time</strong>. The creator pool below is allocated by watch-time
              proportion across the period.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-green-400 uppercase tracking-wider mb-1">Creator pool (60%)</p>
                <p className="text-2xl font-bold text-green-400">{formatZar(p.creatorPool)}</p>
                <p className="text-xs text-slate-500 mt-1">Divided by watch-time proportion</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">Story Time retained (40%)</p>
                <p className="text-2xl font-bold text-blue-400">{formatZar(p.platformCut)}</p>
                <p className="text-xs text-slate-500 mt-1">Platform operations from viewer subscriptions</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Marketplace (3%), script review, casting fees, creator licences, and company subscriptions are booked separately as
              Story Time platform revenue — not part of this viewer pool.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-orange-400" /> Revenue Formula</h3>
            <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm text-slate-300 space-y-1">
              <p>Creator Revenue = (Creator Watch Time / Total Watch Time) × Creator Pool</p>
              <p className="text-xs text-slate-500">
                Creator Pool = Viewer Pool Revenue × 0.60 = {formatZar(data?.viewerSub?.viewerSubRevenue ?? p.revenuePool, { maximumFractionDigits: 0 })} × 0.60 ={" "}
                {formatZar(p.creatorPool)}
              </p>
              <p className="text-xs text-slate-500">
                Story Time share = Viewer Pool Revenue × 0.40 = {formatZar(data?.viewerSub?.storyTimeFromSubs ?? p.platformCut)}
              </p>
              <p className="text-xs text-slate-500">Total Watch Time This Period = {Math.floor(p.totalWatchTime / 3600)}h {Math.floor((p.totalWatchTime % 3600) / 60)}m</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-orange-400" /> Key Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Revenue / title (approx.)",
                  value: formatZar(p.totalWatchTime > 0 ? totalCreatorPayout / Math.max(1, contentRevenue.length) : 0, {
                    maximumFractionDigits: 4,
                  }),
                },
                {
                  label: "Avg Creator Payout",
                  value: formatZar(creators.length > 0 ? totalCreatorPayout / creators.length : 0),
                },
                {
                  label: "Highest Earner",
                  value: formatZar(creators.length > 0 ? Math.max(...creators.map((c) => c.revenue)) : 0),
                },
                { label: "Watch Hours (Total)", value: `${Math.floor(p.totalWatchTime / 3600)}h` },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                  <p className="text-lg font-bold text-white">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "creators" && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Creator</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Role</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Content</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Watch Time</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Share %</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Payout</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Sync Earnings</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Total</th>
              </tr></thead>
              <tbody>
                {creators.sort((a, b) => (b.revenue + b.syncEarnings) - (a.revenue + a.syncEarnings)).map((c) => (
                  <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-3 px-4"><p className="text-white font-medium">{c.name || "—"}</p><p className="text-xs text-slate-500">{c.email}</p></td>
                    <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded text-xs ${c.role.includes("MUSIC") ? "bg-pink-500/20 text-pink-400" : "bg-emerald-500/20 text-emerald-400"}`}>{c.role.replace(/_/g, " ")}</span></td>
                    <td className="py-3 px-4 text-slate-400">{c.contentCount} titles / {c.trackCount} tracks</td>
                    <td className="py-3 px-4 text-slate-400">{Math.floor(c.watchTime / 60)}m</td>
                    <td className="py-3 px-4"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${c.share}%` }} /></div><span className="text-slate-400 text-xs">{c.share}%</span></div></td>
                    <td className="py-3 px-4 text-green-400 font-medium">{formatZar(c.revenue)}</td>
                    <td className="py-3 px-4 text-pink-400">{formatZar(c.syncEarnings)}</td>
                    <td className="py-3 px-4 text-orange-400 font-bold">{formatZar(c.revenue + c.syncEarnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "content" && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Title</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Creator</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Watch Time</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Share %</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Revenue Generated</th>
              </tr></thead>
              <tbody>
                {contentRevenue.sort((a, b) => b.revenue - a.revenue).map((c) => (
                  <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-white font-medium">{c.title}</td>
                    <td className="py-3 px-4 text-slate-400">{c.type}</td>
                    <td className="py-3 px-4 text-slate-400">{c.creatorName}</td>
                    <td className="py-3 px-4 text-slate-400">{Math.floor(c.watchTime / 60)}m</td>
                    <td className="py-3 px-4"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(c.share * 5, 100)}%` }} /></div><span className="text-slate-400 text-xs">{c.share.toFixed(1)}%</span></div></td>
                    <td className="py-3 px-4 text-green-400 font-medium">{formatZar(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "sync" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Total Sync Deals</p>
              <p className="text-3xl font-bold text-white">{sync.totalDeals}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Total Sync Revenue</p>
              <p className="text-3xl font-bold text-pink-400">{formatZar(sync.totalSyncRevenue)}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3">How Sync Revenue Works</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Music creators earn sync licensing fees when their tracks are placed in films and shows on the platform. Each sync deal is negotiated per-placement. Revenue goes directly to the music creator in addition to their watch-time-based earnings. Figures here are{" "}
              <span className="text-slate-300">all-time deal amounts</span>, unlike watch-pool lines which follow the month-to-date window above.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {creators.filter((c) => c.syncEarnings > 0).map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <p className="text-white font-medium text-sm">{c.name}</p>
                  <p className="text-pink-400 font-bold">{formatZar(c.syncEarnings)}</p>
                  <p className="text-xs text-slate-500">{c.trackCount} tracks</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "financials" && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Viewer pool split — subscriptions + PPV (60% creators / 40% Story Time)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/30">
                <p className="text-xs text-slate-500 mb-1">Viewer pool revenue (ZAR)</p>
                <p className="text-2xl font-bold text-white">{formatZar(data?.viewerSub?.viewerSubRevenue ?? 0)}</p>
              </div>
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-green-400 mb-1">Creator pool (60%)</p>
                <p className="text-2xl font-bold text-green-400">{formatZar(data?.viewerSub?.creatorPoolFromSubs ?? 0)}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <p className="text-xs text-orange-400 mb-1">Story Time retained (40%)</p>
                <p className="text-2xl font-bold text-orange-400">{formatZar(data?.viewerSub?.storyTimeFromSubs ?? 0)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Transaction fees (3%)</p>
              <p className="text-2xl font-bold text-white">{formatZar(data?.transactionFees?.totalFees ?? 0)}</p>
              <p className="text-xs text-slate-500 mt-1">Volume: {formatZar(data?.transactionFees?.totalVolume ?? 0)}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">
                Company subscriptions ({formatZar(COMPANY_PLAN_CONFIG.STANDARD.price)} / {formatZar(COMPANY_PLAN_CONFIG.FEATURED.price)})
              </p>
              <p className="text-2xl font-bold text-white">{formatZar(data?.companySubs?.revenue ?? 0)}</p>
              <p className="text-xs text-slate-500 mt-1">{data?.companySubs?.count ?? 0} active</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">
                Creator plans (per film {formatZar(CREATOR_PER_FILM_UPLOAD_PRICE)} · catalogue unlimited{" "}
                {formatZar(CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price)}/yr · pipeline{" "}
                {formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price)}/yr or {formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price)}/mo; legacy per-upload{" "}
                {formatZar(CREATOR_LICENSE_CONFIG.PER_UPLOAD.price)})
              </p>
              <p className="text-2xl font-bold text-white">{formatZar(data?.distributionLicenses?.revenue ?? 0)}</p>
              <p className="text-xs text-slate-500 mt-1">{data?.distributionLicenses?.yearlyCount ?? 0} yearly · {data?.distributionLicenses?.perUploadCount ?? 0} per-upload</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-2">Story Time total (100% of fees, company subs, dist licenses + 40% viewer sub)</h3>
            <p className="text-2xl font-bold text-orange-500">
              {formatZar(
                (data?.viewerSub?.storyTimeFromSubs ?? 0) +
                  (data?.transactionFees?.totalFees ?? 0) +
                  (data?.companySubs?.revenue ?? 0) +
                  (data?.distributionLicenses?.revenue ?? 0),
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
