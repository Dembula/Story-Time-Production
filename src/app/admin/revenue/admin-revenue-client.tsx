"use client";

import { useEffect, useState } from "react";
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
  platform: { revenuePool: number; totalWatchTime: number; platformCut: number; creatorPool: number };
  creators: Creator[];
  syncDeals: { totalDeals: number; totalSyncRevenue: number };
  contentRevenue: { id: string; title: string; type: string; creatorName: string; watchTime: number; share: number; revenue: number }[];
  viewerSub?: { viewerSubRevenue: number; creatorPoolFromSubs: number; storyTimeFromSubs: number };
  transactionFees?: { totalFees: number; totalVolume: number };
  companySubs?: { count: number; revenue: number };
  distributionLicenses?: { yearlyCount: number; perUploadCount: number; revenue: number };
}

export function AdminRevenueClient() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "creators" | "content" | "sync" | "financials">("overview");

  useEffect(() => {
    fetch("/api/admin/revenue").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  const p = data?.platform || { revenuePool: 10000, totalWatchTime: 0, platformCut: 0, creatorPool: 0 };
  const creators = data?.creators || [];
  const contentRevenue = data?.contentRevenue || [];
  const sync = data?.syncDeals || { totalDeals: 0, totalSyncRevenue: 0 };
  const totalCreatorPayout = creators.reduce((s, c) => s + c.revenue, 0);
  const platformRetained = p.revenuePool - totalCreatorPayout;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><DollarSign className="w-8 h-8 text-orange-500" /> Revenue Intelligence</h1>
        <p className="text-slate-400">Complete financial breakdown — platform revenue, creator payouts, sync licensing, and per-content earnings.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue Pool", value: `$${p.revenuePool.toLocaleString()}`, icon: Wallet, color: "text-orange-400", sub: "Monthly allocation" },
          { label: "Creator Payouts", value: `$${totalCreatorPayout.toFixed(2)}`, icon: Users, color: "text-green-400", sub: `${creators.length} creators` },
          { label: "Platform Retained", value: `$${platformRetained.toFixed(2)}`, icon: Building2, color: "text-blue-400", sub: `${((platformRetained / p.revenuePool) * 100).toFixed(1)}% margin` },
          { label: "Sync Licensing", value: `$${sync.totalSyncRevenue.toFixed(2)}`, icon: Music, color: "text-pink-400", sub: `${sync.totalDeals} deals` },
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
            <p className="text-sm text-slate-400 mb-4">How the monthly ${p.revenuePool.toLocaleString()} pool is distributed. Creators earn proportional to their share of total platform watch time.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-green-400 uppercase tracking-wider mb-1">Creator Share (70%)</p>
                <p className="text-2xl font-bold text-green-400">${(p.revenuePool * 0.7).toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Divided by watch-time proportion</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">Platform Operations (20%)</p>
                <p className="text-2xl font-bold text-blue-400">${(p.revenuePool * 0.2).toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Infrastructure, CDN, support</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <p className="text-xs text-purple-400 uppercase tracking-wider mb-1">Growth Fund (10%)</p>
                <p className="text-2xl font-bold text-purple-400">${(p.revenuePool * 0.1).toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Marketing, student films partnerships, development</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-orange-400" /> Revenue Formula</h3>
            <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm text-slate-300 space-y-1">
              <p>Creator Revenue = (Creator Watch Time / Total Watch Time) × Creator Pool</p>
              <p className="text-xs text-slate-500">Creator Pool = Revenue Pool × 0.70 = ${p.revenuePool.toLocaleString()} × 0.70 = ${(p.revenuePool * 0.7).toFixed(2)}</p>
              <p className="text-xs text-slate-500">Total Watch Time This Period = {Math.floor(p.totalWatchTime / 3600)}h {Math.floor((p.totalWatchTime % 3600) / 60)}m</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-orange-400" /> Key Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Revenue Per View", value: `$${p.totalWatchTime > 0 ? (totalCreatorPayout / Math.max(1, contentRevenue.length)).toFixed(4) : "0.00"}` },
                { label: "Avg Creator Payout", value: `$${creators.length > 0 ? (totalCreatorPayout / creators.length).toFixed(2) : "0.00"}` },
                { label: "Highest Earner", value: `$${creators.length > 0 ? Math.max(...creators.map((c) => c.revenue)).toFixed(2) : "0.00"}` },
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
                    <td className="py-3 px-4 text-green-400 font-medium">${c.revenue.toFixed(2)}</td>
                    <td className="py-3 px-4 text-pink-400">${c.syncEarnings.toFixed(2)}</td>
                    <td className="py-3 px-4 text-orange-400 font-bold">${(c.revenue + c.syncEarnings).toFixed(2)}</td>
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
                    <td className="py-3 px-4 text-green-400 font-medium">${c.revenue.toFixed(2)}</td>
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
              <p className="text-3xl font-bold text-pink-400">${sync.totalSyncRevenue.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-3">How Sync Revenue Works</h3>
            <p className="text-sm text-slate-400 leading-relaxed">Music creators earn sync licensing fees when their tracks are placed in films and shows on the platform. Each sync deal is negotiated per-placement. Revenue goes directly to the music creator in addition to their watch-time-based earnings.</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {creators.filter((c) => c.syncEarnings > 0).map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <p className="text-white font-medium text-sm">{c.name}</p>
                  <p className="text-pink-400 font-bold">${c.syncEarnings.toFixed(2)}</p>
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
            <h3 className="text-white font-semibold mb-4">Viewer subscription split (60% creators / 40% Story Time)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/30">
                <p className="text-xs text-slate-500 mb-1">Viewer sub revenue (ZAR)</p>
                <p className="text-2xl font-bold text-white">R{(data?.viewerSub?.viewerSubRevenue ?? 0).toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-green-400 mb-1">Creator pool (60%)</p>
                <p className="text-2xl font-bold text-green-400">R{(data?.viewerSub?.creatorPoolFromSubs ?? 0).toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <p className="text-xs text-orange-400 mb-1">Story Time retained (40%)</p>
                <p className="text-2xl font-bold text-orange-400">R{(data?.viewerSub?.storyTimeFromSubs ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Transaction fees (3%)</p>
              <p className="text-2xl font-bold text-white">R{(data?.transactionFees?.totalFees ?? 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Volume: R{(data?.transactionFees?.totalVolume ?? 0).toFixed(2)}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Company subscriptions (R29 / R49)</p>
              <p className="text-2xl font-bold text-white">R{(data?.companySubs?.revenue ?? 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{data?.companySubs?.count ?? 0} active</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs text-slate-400 mb-1">Distribution licenses (R89 yearly)</p>
              <p className="text-2xl font-bold text-white">R{(data?.distributionLicenses?.revenue ?? 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{data?.distributionLicenses?.yearlyCount ?? 0} yearly · {data?.distributionLicenses?.perUploadCount ?? 0} per-upload</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-2">Story Time total (100% of fees, company subs, dist licenses + 40% viewer sub)</h3>
            <p className="text-2xl font-bold text-orange-500">
              R{((data?.viewerSub?.storyTimeFromSubs ?? 0) + (data?.transactionFees?.totalFees ?? 0) + (data?.companySubs?.revenue ?? 0) + (data?.distributionLicenses?.revenue ?? 0)).toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
