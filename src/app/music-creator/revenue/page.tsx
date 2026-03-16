"use client";

import { useEffect, useState } from "react";
import {
  DollarSign, TrendingUp, Film, Music, BarChart3, PieChart,
  Wallet, ArrowUpRight, Clock, Target,
} from "lucide-react";

interface Stats {
  totalTracks: number; totalSyncEarnings: number; totalPlacements: number; paidDeals: number;
  pendingRequests: number; approvedRequests: number; totalRequests: number;
  genres: string[]; potentialRevenue: number;
  earningsByTrack: { id: string; title: string; genre: string | null; earnings: number; placements: number; requests: number; pendingRequests: number }[];
  earningsByFilm: { track: string; film: string; filmType: string; amount: number; status: string }[];
}

export default function MusicRevenuePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "tracks" | "placements">("overview");

  useEffect(() => {
    fetch("/api/music/stats").then((r) => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>;

  const s = stats!;
  const avgPerPlacement = s.totalPlacements > 0 ? s.totalSyncEarnings / s.totalPlacements : 0;
  const avgPerTrack = s.totalTracks > 0 ? s.totalSyncEarnings / s.totalTracks : 0;
  const conversionRate = s.totalRequests > 0 ? ((s.approvedRequests / s.totalRequests) * 100) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><DollarSign className="w-8 h-8 text-orange-500" /> Revenue Dashboard</h1>
        <p className="text-slate-400">Comprehensive earnings breakdown — see exactly how your music generates income on the platform.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Earned", value: `$${s.totalSyncEarnings.toFixed(2)}`, icon: Wallet, color: "text-orange-400", sub: "All-time sync earnings" },
          { label: "Potential Revenue", value: `$${s.potentialRevenue.toFixed(2)}`, icon: Target, color: "text-yellow-400", sub: `${s.pendingRequests} pending requests` },
          { label: "Avg / Placement", value: `$${avgPerPlacement.toFixed(2)}`, icon: TrendingUp, color: "text-emerald-400", sub: `${s.totalPlacements} placements` },
          { label: "Conversion Rate", value: `${conversionRate.toFixed(0)}%`, icon: ArrowUpRight, color: "text-cyan-400", sub: `${s.approvedRequests} of ${s.totalRequests} approved` },
        ].map((card) => (
          <div key={card.label} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><card.icon className={`w-4 h-4 ${card.color}`} /><span className="text-xs text-slate-400">{card.label}</span></div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {(["overview", "tracks", "placements"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${tab === t ? "bg-pink-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>{t}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><PieChart className="w-5 h-5 text-pink-400" /> How Your Revenue is Generated</h3>
            <p className="text-sm text-slate-400 mb-4">Your music earns revenue through sync licensing. When a film creator uses your track in their production, you receive a sync fee based on the agreed terms.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/20">
                <p className="text-xs text-pink-400 uppercase tracking-wider mb-1">Sync Licensing</p>
                <p className="text-2xl font-bold text-pink-400">${s.totalSyncEarnings.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Direct placements in films and content</p>
              </div>
              <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <p className="text-xs text-yellow-400 uppercase tracking-wider mb-1">Pending Deals</p>
                <p className="text-2xl font-bold text-yellow-400">${s.potentialRevenue.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Awaiting your approval</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Projected Monthly</p>
                <p className="text-2xl font-bold text-emerald-400">${(s.totalSyncEarnings * 0.15).toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">Based on current trajectory</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-orange-400" /> Revenue Formula</h3>
            <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm text-slate-300 space-y-2">
              <p>Sync Revenue = Sum of all approved sync deal amounts</p>
              <p>Potential Revenue = Sum of pending request budgets</p>
              <p className="text-xs text-slate-500">Total Sync Earnings: ${s.totalSyncEarnings.toFixed(2)} from {s.totalPlacements} placements</p>
              <p className="text-xs text-slate-500">Average per placement: ${avgPerPlacement.toFixed(2)}</p>
              <p className="text-xs text-slate-500">Average earnings per track: ${avgPerTrack.toFixed(2)} across {s.totalTracks} tracks</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Tracks", value: s.totalTracks },
              { label: "Paid Deals", value: s.paidDeals },
              { label: "Total Placements", value: s.totalPlacements },
              { label: "Avg / Track", value: `$${avgPerTrack.toFixed(2)}` },
            ].map((m) => (
              <div key={m.label} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                <p className="text-lg font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "tracks" && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Track</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Genre</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Placements</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Requests</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Pending</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Earnings</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Share</th>
              </tr></thead>
              <tbody>
                {s.earningsByTrack.sort((a, b) => b.earnings - a.earnings).map((t) => {
                  const pct = s.totalSyncEarnings > 0 ? (t.earnings / s.totalSyncEarnings) * 100 : 0;
                  return (
                    <tr key={t.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-white font-medium">{t.title}</td>
                      <td className="py-3 px-4 text-slate-400">{t.genre || "—"}</td>
                      <td className="py-3 px-4 text-slate-400">{t.placements}</td>
                      <td className="py-3 px-4 text-slate-400">{t.requests}</td>
                      <td className="py-3 px-4">{t.pendingRequests > 0 ? <span className="text-yellow-400 font-medium">{t.pendingRequests}</span> : <span className="text-slate-500">0</span>}</td>
                      <td className="py-3 px-4 text-orange-400 font-medium">${t.earnings.toFixed(2)}</td>
                      <td className="py-3 px-4"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-pink-500 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-xs text-slate-400">{pct.toFixed(0)}%</span></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "placements" && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Track</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Film / Content</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Amount</th>
              </tr></thead>
              <tbody>
                {s.earningsByFilm.sort((a, b) => b.amount - a.amount).map((d, i) => (
                  <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-white font-medium">{d.track}</td>
                    <td className="py-3 px-4 text-slate-300">{d.film}</td>
                    <td className="py-3 px-4 text-slate-400">{d.filmType}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${d.status === "PAID" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>{d.status}</span></td>
                    <td className="py-3 px-4 text-orange-400 font-medium">${d.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
