"use client";

import { useEffect, useState } from "react";
import { formatZar } from "@/lib/format-currency-zar";
import type { MusicCreatorSyncStatsPayload } from "@/lib/financial-ledger";
import {
  Music, DollarSign, Disc, ChevronDown, ChevronUp, Globe, GraduationCap,
  BookOpen, Target, Briefcase, ExternalLink, BarChart3, TrendingUp, Film,
} from "lucide-react";

interface Artist {
  id: string; name: string | null; email: string | null;
  bio: string | null; socialLinks: string | null; education: string | null;
  goals: string | null; previousWork: string | null; isAfdaStudent: boolean;
  totalTracks: number; totalEarnings: number; totalPlacements: number;
  genres: string[];
  musicTracks: { id: string; title: string; artistName: string; genre: string | null; syncDeals: { amount: number; status: string; content: { title: string; type: string } }[] }[];
}

export function AdminMusicClient() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [impersonationStats, setImpersonationStats] = useState<MusicCreatorSyncStatsPayload | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/music").then((r) => r.json()).then(setArtists).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!expanded) {
      setImpersonationStats(null);
      return;
    }
    setStatsLoading(true);
    fetch(`/api/music/stats?creatorId=${encodeURIComponent(expanded)}`)
      .then((r) => r.json())
      .then((body) => {
        if (body && typeof body.totalTracks === "number") setImpersonationStats(body as MusicCreatorSyncStatsPayload);
        else setImpersonationStats(null);
      })
      .catch(() => setImpersonationStats(null))
      .finally(() => setStatsLoading(false));
  }, [expanded]);

  const filtered = artists.filter((a) => !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase()));
  const totalTracks = artists.reduce((s, a) => s + a.totalTracks, 0);
  const totalEarnings = artists.reduce((s, a) => s + a.totalEarnings, 0);
  const totalPlacements = artists.reduce((s, a) => s + a.totalPlacements, 0);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Music className="w-8 h-8 text-orange-500" /> Music Creator Analytics</h1>
        <p className="text-slate-400">Full profiles, track catalogues, sync licensing performance, and earnings for all music creators.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Artists</p><p className="text-2xl font-bold text-white">{artists.length}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Tracks</p><p className="text-2xl font-bold text-white">{totalTracks}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Sync Placements</p><p className="text-2xl font-bold text-white">{totalPlacements}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Earnings</p><p className="text-2xl font-bold text-pink-400">{formatZar(totalEarnings)}</p></div>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search artists..." className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />

      <div className="space-y-4">
        {filtered.map((a) => {
          const socials = a.socialLinks ? (() => { try { return JSON.parse(a.socialLinks); } catch { return null; } })() : null;
          return (
            <div key={a.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="p-5 cursor-pointer hover:bg-slate-800/70 transition" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(a.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold text-lg">{a.name || "Unnamed"}</h3>
                      {a.isAfdaStudent && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400"><GraduationCap className="w-3 h-3 inline" /> Student</span>}
                    </div>
                    <p className="text-sm text-slate-500">{a.email} · {a.totalTracks} tracks · {a.genres.join(", ") || "No genre"}</p>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    <div className="text-right"><p className="text-xl font-bold text-pink-400">{formatZar(a.totalEarnings)}</p><p className="text-xs text-slate-500">Earnings</p></div>
                    <div className="text-right"><p className="text-xl font-bold text-white">{a.totalPlacements}</p><p className="text-xs text-slate-500">Placements</p></div>
                    <div className="text-right"><p className="text-xl font-bold text-cyan-400">{a.totalTracks}</p><p className="text-xs text-slate-500">Tracks</p></div>
                  </div>
                  {expanded === a.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {expanded === a.id && (
                <div className="border-t border-slate-700/50 p-5 bg-slate-900/30 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2"><BookOpen className="w-4 h-4 text-pink-400" /> Artist Profile</h4>
                      {a.bio && <div><p className="text-xs text-slate-500 mb-1">Bio</p><p className="text-sm text-slate-300 leading-relaxed">{a.bio}</p></div>}
                      {a.education && <div><p className="text-xs text-slate-500 mb-1"><GraduationCap className="w-3 h-3 inline" /> Education</p><p className="text-sm text-slate-300">{a.education}</p></div>}
                      {a.previousWork && <div><p className="text-xs text-slate-500 mb-1"><Briefcase className="w-3 h-3 inline" /> Previous Work</p><p className="text-sm text-slate-300">{a.previousWork}</p></div>}
                      {a.goals && <div><p className="text-xs text-slate-500 mb-1"><Target className="w-3 h-3 inline" /> Goals</p><p className="text-sm text-slate-300">{a.goals}</p></div>}
                      {socials && (
                        <div><p className="text-xs text-slate-500 mb-1"><Globe className="w-3 h-3 inline" /> Social</p>
                          <div className="flex flex-wrap gap-2">{Object.entries(socials).map(([k, v]) => <a key={k} href={String(v).startsWith("http") ? String(v) : `https://${v}`} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded bg-slate-700/50 text-pink-400 hover:text-pink-300 flex items-center gap-1"><ExternalLink className="w-3 h-3" />{k}</a>)}</div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-pink-400" /> Performance</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Total Earnings", value: formatZar(a.totalEarnings), icon: DollarSign },
                          { label: "Sync Placements", value: a.totalPlacements.toString(), icon: Film },
                          { label: "Tracks", value: a.totalTracks.toString(), icon: Disc },
                          { label: "Genres", value: a.genres.length.toString(), icon: Music },
                        ].map((s) => (
                          <div key={s.label} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                            <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3 h-3 text-pink-400" /><span className="text-xs text-slate-500">{s.label}</span></div>
                            <p className="text-lg font-bold text-white">{s.value}</p>
                          </div>
                        ))}
                      </div>
                      {statsLoading && <p className="text-xs text-slate-500">Loading live sync stats…</p>}
                      {impersonationStats && !statsLoading && (
                        <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-3 space-y-2">
                          <p className="text-xs font-medium text-pink-300 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Live stats (GET /api/music/stats?creatorId=…)</p>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                            <span>Paid deals: <span className="text-white font-medium">{impersonationStats.paidDeals}</span></span>
                            <span>Pending requests: <span className="text-amber-300 font-medium">{impersonationStats.pendingRequests}</span></span>
                            <span>Approved requests: <span className="text-emerald-300 font-medium">{impersonationStats.approvedRequests}</span></span>
                            <span>Potential (pending budgets): <span className="text-orange-300 font-medium">{formatZar(impersonationStats.potentialRevenue, { maximumFractionDigits: 0 })}</span></span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2"><Disc className="w-4 h-4 text-pink-400" /> Track Catalogue ({a.musicTracks.length})</h4>
                    <div className="space-y-2">
                      {a.musicTracks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                          <div>
                            <p className="text-white font-medium">{t.title}</p>
                            <p className="text-xs text-slate-500">{t.artistName} · {t.genre || "—"}</p>
                          </div>
                          <div className="text-right space-y-0.5">
                            {t.syncDeals.length > 0 ? t.syncDeals.map((d, i) => (
                              <p key={i} className="text-xs"><span className="text-slate-400">{d.content.title}</span> <span className="text-pink-400 font-medium">{formatZar(d.amount)}</span></p>
                            )) : <p className="text-xs text-slate-500">No placements</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
