"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Music, DollarSign, Disc, Film, TrendingUp, Headphones, BarChart3,
  Clock, Users, MessageSquare, ArrowRight, Sparkles, Bell,
} from "lucide-react";
import {
  CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY,
  getCreatorLicenseConfig,
  normalizeCreatorLicenseType,
} from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions } from "@/components/ecosystem/ops-shell";
import { StakeholderEcosystemHome } from "@/components/ecosystem/stakeholder-ecosystem-home";
import { MusicTrackPreview } from "@/components/music/music-track-preview";

interface SyncDeal { status: string; amount: number; content: { title: string; type?: string } }
interface SyncReq {
  status: string;
  requester: { name: string | null; email?: string | null };
  _count?: { messages: number };
}
interface Track {
  id: string; title: string; artistName: string; genre: string | null; mood: string | null;
  bpm: number | null; duration: number | null; coverUrl: string | null; audioUrl: string | null;
  syncDeals: SyncDeal[];
  syncRequests: SyncReq[];
  musicSelections?: { id: string; project: { title: string; status: string } }[];
  _count: { syncDeals: number; syncRequests: number; musicSelections?: number };
}

interface Stats {
  totalTracks: number; totalSyncEarnings: number; totalPlacements: number; paidDeals: number;
  pendingRequests: number; approvedRequests: number; totalRequests: number;
  genres: string[]; potentialRevenue: number;
  earningsByTrack: { id: string; title: string; genre: string | null; earnings: number; placements: number; requests: number; pendingRequests: number }[];
  earningsByFilm: { track: string; film: string; filmType: string; amount: number; status: string }[];
}

export function MusicDashboardClient() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: licenseData } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()),
  });
  const license = licenseData?.license;

  useEffect(() => {
    Promise.all([
      fetch("/api/music").then((r) => r.json()),
      fetch("/api/music/stats").then((r) => r.json()),
    ]).then(([t, s]) => { setTracks(t); setStats(s); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>;

  const s = stats!;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <OpsPageHeader
        title="Music creator operating system"
        subtitle="Catalogue, sync licensing, placements, and revenue — amounts in ZAR."
        badge={
          license ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
              {normalizeCreatorLicenseType(license.type) === "YEARLY"
                ? `Yearly license (${formatZar(getCreatorLicenseConfig("YEARLY").price)})`
                : `Pay per upload (${formatZar(getCreatorLicenseConfig("PER_UPLOAD").price)})`}
            </span>
          ) : null
        }
        actions={
          <Link
            href="/music-creator/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-pink-600"
          >
            <Music className="w-4 h-4" /> Upload track
          </Link>
        }
      />

      <StakeholderEcosystemHome portalPrefix="/music-creator" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <OpsMetricCard label="Catalogue tracks" value={s.totalTracks} sub="Published library" icon={Disc} accent="violet" />
        <OpsMetricCard
          label="Sync earnings"
          value={formatZar(s.totalSyncEarnings)}
          sub={`${s.paidDeals} paid deals`}
          icon={DollarSign}
          accent="orange"
        />
        <OpsMetricCard label="Film placements" value={s.totalPlacements} sub="Active syncs" icon={Film} accent="emerald" />
        <OpsMetricCard
          label="Pending requests"
          value={s.pendingRequests}
          sub={`${formatZar(s.potentialRevenue, { maximumFractionDigits: 0 })} potential`}
          icon={Bell}
          accent="amber"
        />
        <OpsMetricCard
          label="Genres represented"
          value={s.genres.length}
          sub={s.genres.slice(0, 3).join(", ") || "—"}
          icon={Headphones}
          accent="cyan"
        />
      </div>

      <OpsQuickActions
        items={[
          { href: "/music-creator/sync-requests", label: "Sync requests", description: "Review inbound licensing inquiries" },
          { href: "/music-creator/deals", label: "Deal pipeline", description: "Approved sync deals and contracts" },
          { href: "/music-creator/revenue", label: "Revenue hub", description: "Earnings by track and placement" },
          { href: "/music-creator/wallet", label: "Wallet", description: "Balances and payout requests" },
          { href: "/music-creator/scoring", label: "Scoring & placements", description: "Production track selections" },
          { href: "/music-creator/contracts", label: "Contracts", description: "Music licensing agreements" },
        ]}
      />

      {/* Pending Sync Requests Alert */}
      {s.pendingRequests > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <div>
              <p className="text-white font-medium">{s.pendingRequests} new sync {s.pendingRequests === 1 ? "request" : "requests"} waiting for your review</p>
              <p className="text-xs text-slate-400">Film creators want to use your music — potential revenue: {formatZar(s.potentialRevenue)}</p>
            </div>
          </div>
          <Link href="/music-creator/sync-requests" className="px-4 py-2 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm font-medium hover:bg-yellow-500/20 transition flex items-center gap-1">
            Review <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings by Track */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-orange-400" /> Earnings by Track</h3>
            <Link href="/music-creator/revenue" className="text-xs text-orange-400 hover:text-orange-300">Full Breakdown →</Link>
          </div>
          <div className="space-y-3">
            {s.earningsByTrack.sort((a, b) => b.earnings - a.earnings).slice(0, 5).map((t) => {
              const pct = s.totalSyncEarnings > 0 ? (t.earnings / s.totalSyncEarnings) * 100 : 0;
              return (
                <div key={t.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{t.title} <span className="text-xs text-slate-500">({t.genre})</span></span>
                    <span className="text-orange-400 font-medium">{formatZar(t.earnings)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden"><div className="h-full bg-orange-500/70 rounded-full" style={{ width: `${pct}%` }} /></div>
                  <p className="text-xs text-slate-500 mt-0.5">{t.placements} placements · {t.requests} requests</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Film Placements */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Film className="w-4 h-4 text-emerald-400" /> Film Placements</h3>
          {s.earningsByFilm.length > 0 ? (
            <div className="space-y-2">
              {s.earningsByFilm.slice(0, 6).map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <div>
                    <p className="text-white text-sm font-medium">{d.track}</p>
                    <p className="text-xs text-slate-500">in &quot;{d.film}&quot; ({d.filmType})</p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-400 font-medium text-sm">{formatZar(d.amount)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${d.status === "PAID" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>{d.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-500 text-sm">No placements yet</p>}
        </div>
      </div>

      {/* Track Library */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2"><Disc className="w-4 h-4 text-pink-400" /> Your Music Library ({tracks.length} tracks)</h3>
          <Link href="/music-creator/upload" className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"><Music className="w-3 h-3" /> Upload New</Link>
        </div>
        <div className="divide-y divide-slate-700/30">
          {tracks.map((t) => {
            const earnings = t.syncDeals?.reduce((a, d) => a + d.amount, 0) || 0;
            return (
              <div key={t.id} className="p-4 flex items-center gap-4 hover:bg-slate-800/40 transition">
                <MusicTrackPreview
                  audioUrl={t.audioUrl}
                  trackId={t.id}
                  title={t.title}
                  variant="compact"
                />
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                  {t.coverUrl ? <img src={t.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-slate-500" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{t.title}</p>
                    {t._count.syncRequests > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{t._count.syncRequests} req</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{t.artistName}</span>
                    {t.genre && <span>· {t.genre}</span>}
                    {t.mood && <span>· {t.mood}</span>}
                    {t.bpm && <span>· {t.bpm} BPM</span>}
                    {t.duration && <span>· {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, "0")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-slate-400">{t._count.syncDeals} placements</p>
                    <p className="text-orange-400 font-medium">{formatZar(earnings)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Upload Music", href: "/music-creator/upload", icon: Music, color: "text-pink-400" },
          { label: "Sync Requests", href: "/music-creator/sync-requests", icon: Users, color: "text-yellow-400" },
          { label: "Revenue", href: "/music-creator/revenue", icon: TrendingUp, color: "text-orange-400" },
          { label: "Messages", href: "/music-creator/messages", icon: MessageSquare, color: "text-cyan-400" },
        ].map((l) => (
          <Link key={l.label} href={l.href} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/50 transition flex items-center gap-3">
            <l.icon className={`w-5 h-5 ${l.color}`} />
            <span className="text-white font-medium text-sm">{l.label}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}
