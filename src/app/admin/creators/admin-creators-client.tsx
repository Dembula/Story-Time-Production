"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Film, DollarSign, Eye, Star, MessageSquare, Users, ChevronDown, ChevronUp,
  GraduationCap, Globe, BookOpen, Target, Briefcase, ExternalLink, TrendingUp,
  Play, BarChart3,
} from "lucide-react";
import { getCreatorLicenseConfig, normalizeCreatorLicenseType } from "@/lib/pricing";

interface Creator {
  id: string; name: string | null; email: string | null; role: string;
  bio: string | null; socialLinks: string | null; education: string | null;
  goals: string | null; previousWork: string | null; isAfdaStudent: boolean;
  revenue: number; revenueShare: number; totalViews: number; avgRating: number; totalComments: number;
  creatorDistributionLicense?: { type: string } | null;
  _count: { contents: number };
  contents: { id: string; title: string; type: string; published: boolean; reviewStatus: string; year: number | null; duration: number | null; category: string | null; _count: { watchSessions: number; ratings: number; comments: number } }[];
}

export function AdminCreatorsClient() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/creators").then((r) => r.json()).then(setCreators).finally(() => setLoading(false));
  }, []);

  const filtered = creators.filter((c) => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Film className="w-8 h-8 text-orange-500" /> Content Creator Analytics</h1>
        <p className="text-slate-400">Full profiles, content performance, revenue contribution, and platform impact for each creator.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Creators</p><p className="text-2xl font-bold text-white">{creators.length}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Content</p><p className="text-2xl font-bold text-white">{creators.reduce((s, c) => s + c._count.contents, 0)}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Views</p><p className="text-2xl font-bold text-white">{creators.reduce((s, c) => s + c.totalViews, 0).toLocaleString()}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Revenue</p><p className="text-2xl font-bold text-orange-400">${creators.reduce((s, c) => s + c.revenue, 0).toFixed(2)}</p></div>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search creators..." className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />

      <div className="space-y-4">
        {filtered.map((c) => {
          const socials = c.socialLinks ? (() => { try { return JSON.parse(c.socialLinks); } catch { return null; } })() : null;
          return (
            <div key={c.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="p-5 cursor-pointer hover:bg-slate-800/70 transition" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(c.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold text-lg">{c.name || "Unnamed"}</h3>
                      {c.isAfdaStudent && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400"><GraduationCap className="w-3 h-3 inline" /> Student</span>}
                      {c.creatorDistributionLicense && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-600/80 text-slate-300">
                          {normalizeCreatorLicenseType(c.creatorDistributionLicense.type) === "YEARLY"
                            ? `Yearly license (R${getCreatorLicenseConfig("YEARLY").price.toFixed(2)})`
                            : `Pay per upload (R${getCreatorLicenseConfig("PER_UPLOAD").price.toFixed(2)})`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{c.email} · {c._count.contents} titles</p>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    <div className="text-right"><p className="text-xl font-bold text-orange-400">${c.revenue.toFixed(2)}</p><p className="text-xs text-slate-500">Revenue</p></div>
                    <div className="text-right"><p className="text-xl font-bold text-white">{c.totalViews.toLocaleString()}</p><p className="text-xs text-slate-500">Views</p></div>
                    <div className="text-right"><p className="text-xl font-bold text-yellow-400">★ {c.avgRating.toFixed(1)}</p><p className="text-xs text-slate-500">Rating</p></div>
                    <div className="text-right"><p className="text-xl font-bold text-cyan-400">{c.totalComments}</p><p className="text-xs text-slate-500">Comments</p></div>
                  </div>
                  {expanded === c.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {expanded === c.id && (
                <div className="border-t border-slate-700/50 p-5 bg-slate-900/30 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2"><BookOpen className="w-4 h-4 text-orange-400" /> Creator Profile</h4>
                      {c.bio && <div><p className="text-xs text-slate-500 mb-1">Bio</p><p className="text-sm text-slate-300 leading-relaxed">{c.bio}</p></div>}
                      {c.education && <div><p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Education</p><p className="text-sm text-slate-300">{c.education}</p></div>}
                      {c.previousWork && <div><p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3" /> Previous Work</p><p className="text-sm text-slate-300">{c.previousWork}</p></div>}
                      {c.goals && <div><p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> Goals</p><p className="text-sm text-slate-300">{c.goals}</p></div>}
                      {socials && (
                        <div><p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Social Links</p>
                          <div className="flex flex-wrap gap-2">{Object.entries(socials).map(([k, v]) => <a key={k} href={String(v).startsWith("http") ? String(v) : `https://${v}`} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded bg-slate-700/50 text-orange-400 hover:text-orange-300 flex items-center gap-1"><ExternalLink className="w-3 h-3" />{k}</a>)}</div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-orange-400" /> Performance Stats</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Revenue Share", value: `${c.revenueShare}%`, icon: DollarSign },
                          { label: "Total Views", value: c.totalViews.toLocaleString(), icon: Eye },
                          { label: "Avg Rating", value: `★ ${c.avgRating.toFixed(1)}`, icon: Star },
                          { label: "Comments", value: c.totalComments.toString(), icon: MessageSquare },
                          { label: "Content Count", value: c._count.contents.toString(), icon: Film },
                          { label: "Revenue", value: `$${c.revenue.toFixed(2)}`, icon: TrendingUp },
                        ].map((s) => (
                          <div key={s.label} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                            <div className="flex items-center gap-1.5 mb-1"><s.icon className="w-3 h-3 text-orange-400" /><span className="text-xs text-slate-500">{s.label}</span></div>
                            <p className="text-lg font-bold text-white">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2"><Film className="w-4 h-4 text-orange-400" /> Content Catalogue ({c.contents.length} titles)</h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-700/50">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-700 bg-slate-800/50">
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Title</th>
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Type</th>
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Status</th>
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Year</th>
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Views</th>
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Ratings</th>
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Comments</th>
                          <th className="text-left py-2.5 px-3 text-slate-400 font-medium"></th>
                        </tr></thead>
                        <tbody>
                          {c.contents.map((ct) => (
                            <tr key={ct.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-white font-medium">{ct.title}</td>
                              <td className="py-2.5 px-3 text-slate-400">{ct.type}</td>
                              <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${ct.reviewStatus === "APPROVED" ? "bg-green-500/10 text-green-400" : ct.reviewStatus === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : "bg-slate-500/10 text-slate-400"}`}>{ct.reviewStatus === "APPROVED" ? "Published" : ct.reviewStatus}</span></td>
                              <td className="py-2.5 px-3 text-slate-400">{ct.year || "—"}</td>
                              <td className="py-2.5 px-3 text-slate-400">{ct._count.watchSessions}</td>
                              <td className="py-2.5 px-3 text-slate-400">{ct._count.ratings}</td>
                              <td className="py-2.5 px-3 text-slate-400">{ct._count.comments}</td>
                              <td className="py-2.5 px-3"><Link href={`/browse/content/${ct.id}`} className="text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1"><Play className="w-3 h-3" />View</Link></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
