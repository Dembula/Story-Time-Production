"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Users, Film, Clock, DollarSign, Music, Handshake, GraduationCap, Globe, Monitor, Activity, TrendingUp, Wifi, Briefcase, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatZar } from "@/lib/format-currency-zar";

export function AdminOverviewClient() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => r.json()),
  });
  const { data: analyticsSummary } = useQuery({
    queryKey: ["admin-analytics-summary"],
    queryFn: () => fetch("/api/admin/analytics/summary").then((r) => r.json()),
  });
  const { data: opsIncidents } = useQuery({
    queryKey: ["admin-ops-incidents"],
    queryFn: () => fetch("/api/admin/ops/incidents").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Skeleton className="mb-8 h-10 w-64 bg-white/[0.06]" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-36 bg-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  const ipEntries = stats?.ipAddresses ? Object.entries(stats.ipAddresses) as [string, { count: number; lastSeen: string; users: string[] }][] : [];
  const deviceEntries = stats?.deviceBreakdown ? Object.entries(stats.deviceBreakdown) as [string, number][] : [];
  const signInEntries = stats?.signInsByRole ? Object.entries(stats.signInsByRole) as [string, number][] : [];

  return (
    <div className="p-8 max-w-7xl mx-auto relative">
      <div className="mb-10">
        <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight text-white">Platform Overview</h1>
        <p className="text-slate-300/78">
          Comprehensive analytics, user intelligence, and content distribution. Amounts are in South African Rand (ZAR).
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {[
          { label: "Total Users", value: stats?.totalUsers ?? 0, sub: "Registered accounts", icon: Users, color: "cyan", href: "/admin/users" },
          { label: "Total Content", value: stats?.totalContent ?? 0, sub: "Published titles", icon: Film, color: "emerald", href: "/admin/content" },
          { label: "Watch Time", value: stats?.totalWatchTime ? `${Math.floor(stats.totalWatchTime / 3600)}h` : "0h", sub: "This month (hours)", icon: Clock, color: "violet", href: "/admin/activity" },
          { label: "Revenue Pool", value: formatZar(stats?.revenuePool ?? 0, { maximumFractionDigits: 0 }), sub: "This period allocation", icon: DollarSign, color: "orange", href: "/admin/revenue" },
          { label: "Music Tracks", value: stats?.totalTracks ?? 0, sub: "Published tracks", icon: Music, color: "pink", href: "/admin/music" },
          { label: "Sync Deals", value: stats?.totalSyncDeals ?? 0, sub: "Placements on platform", icon: Handshake, color: "amber", href: "/admin/revenue" },
          { label: "Student Films", value: stats?.afdaStudents ?? 0, sub: "Student creators", icon: GraduationCap, color: "teal", href: "/admin/creators" },
          { label: "Unique Watchers", value: stats?.uniqueWatchers ?? 0, sub: `Avg ${Math.round((stats?.avgWatchTimePerUser ?? 0) / 60)} min/user (this month)`, icon: TrendingUp, color: "blue", href: "/admin/users" },
          { label: "Crew Teams", value: stats?.crewTeamCount ?? 0, sub: `${stats?.crewTotalMembers ?? 0} members · ${stats?.crewRequestCount ?? 0} requests`, icon: Briefcase, color: "emerald", href: "/admin/crew" },
          { label: "Casting Agencies", value: stats?.castingAgencyCount ?? 0, sub: `${stats?.castTotalTalent ?? 0} talent · ${stats?.castInquiryCount ?? 0} inquiries · ${stats?.auditionCount ?? 0} auditions`, icon: Megaphone, color: "violet", href: "/admin/cast" },
          { label: "Events (30d)", value: analyticsSummary?.eventsCount ?? 0, sub: `${analyticsSummary?.topEvents?.[0]?.name ?? "No events"} top signal`, icon: Activity, color: "blue", href: "/admin/activity" },
          { label: "Open Ops Incidents", value: opsIncidents?.incidents?.length ?? 0, sub: "Automated ledger health checks", icon: Wifi, color: "amber", href: "/admin/activity" },
        ].map((card, i) => {
          const colorMap: Record<string, string> = {
            cyan: "border-l-cyan-500/50", emerald: "border-l-emerald-500/50", violet: "border-l-violet-500/50",
            orange: "border-l-orange-500/50", pink: "border-l-pink-500/50", amber: "border-l-amber-500/50",
            teal: "border-l-teal-500/50", blue: "border-l-blue-500/50",
          };
          const iconColor: Record<string, string> = {
            cyan: "text-cyan-400/80", emerald: "text-emerald-400/80", violet: "text-violet-400/80",
            orange: "text-orange-400", pink: "text-pink-400/80", amber: "text-amber-400/80",
            teal: "text-teal-400/80", blue: "text-blue-400/80",
          };
          const href = (card as { href?: string }).href;
          const cardEl = (
            <Card key={i} className={`storytime-kpi hover:-translate-y-1 hover:bg-white/[0.05] transition border-l-4 ${colorMap[card.color]} ${href ? "cursor-pointer" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">{card.label}</CardTitle>
                <card.icon className={`w-5 h-5 ${iconColor[card.color]}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${card.color === "orange" ? "text-orange-500" : "text-white"}`}>{card.value}</p>
                <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          );
          return href ? <Link key={i} href={href} className="block">{cardEl}</Link> : cardEl;
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Content by Type */}
        {stats?.contentByType?.length > 0 && (
          <Card className="storytime-section">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Film className="w-5 h-5 text-emerald-400" /> Content by Type</span>
                <Link href="/admin/content" className="text-xs font-medium text-orange-300 hover:text-orange-200">Open catalogue →</Link>
              </CardTitle>
              <p className="text-sm text-slate-400">Distribution across content categories</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.contentByType.map((c: { type: string; _count: { id: number } }) => {
                  const total = stats.contentByType.reduce((s: number, x: { _count: { id: number } }) => s + x._count.id, 0);
                  const pct = total > 0 ? (c._count.id / total) * 100 : 0;
                  return (
                    <div key={c.type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{c.type}</span>
                        <span className="text-white font-medium">{c._count.id}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full bg-orange-500/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users by Role */}
        {stats?.usersByRole?.length > 0 && (
          <Card className="storytime-section">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> Users by Role</span>
                <Link href="/admin/users" className="text-xs font-medium text-orange-300 hover:text-orange-200">User directory →</Link>
              </CardTitle>
              <p className="text-sm text-slate-400">Platform audience breakdown</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.usersByRole.map((r: { role: string; _count: { id: number } }) => {
                  const total = stats.usersByRole.reduce((s: number, x: { _count: { id: number } }) => s + x._count.id, 0);
                  const pct = total > 0 ? (r._count.id / total) * 100 : 0;
                  const colorMap: Record<string, string> = {
                    SUBSCRIBER: "bg-cyan-500/70", CONTENT_CREATOR: "bg-emerald-500/70",
                    MUSIC_CREATOR: "bg-pink-500/70", ADMIN: "bg-orange-500/70",
                  };
                  return (
                    <div key={r.role}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{r.role.replace(/_/g, " ")}</span>
                        <span className="text-white font-medium">{r._count.id}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className={`h-full rounded-full ${colorMap[r.role] || "bg-slate-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sign-ins by Role */}
      {signInEntries.length > 0 && (
        <Card className="storytime-section mb-10">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Activity className="w-5 h-5 text-violet-400" /> Sign-ins by Role</span>
              <Link href="/admin/activity" className="text-xs font-medium text-orange-300 hover:text-orange-200">Full activity log →</Link>
            </CardTitle>
            <p className="text-sm text-slate-400">Sign-in events in the last 90 days (from database)</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {signInEntries.map(([role, count]) => (
                <div key={role} className="storytime-panel min-w-[140px] rounded-xl p-4">
                  <p className="text-sm text-slate-400 font-medium">{role.replace(/_/g, " ")}</p>
                  <p className="text-2xl font-bold text-white mt-1">{count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Device Breakdown */}
        {deviceEntries.length > 0 && (
          <Card className="storytime-section">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Monitor className="w-5 h-5 text-blue-400" /> Devices</CardTitle>
              <p className="text-sm text-slate-400">
                Inferred from User-Agent on sign-in and session telemetry (last 90 days).
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deviceEntries.sort((a, b) => (b[1] as number) - (a[1] as number)).map(([device, count]) => {
                  const total = deviceEntries.reduce((s, [, c]) => s + (c as number), 0);
                  const pct = total > 0 ? ((count as number) / total) * 100 : 0;
                  return (
                    <div key={device}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{device}</span>
                        <span className="text-white font-medium">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* IP Addresses */}
        {ipEntries.length > 0 && (
          <Card className="storytime-section">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400" /> IP Addresses</CardTitle>
              <p className="text-sm text-slate-400">From request headers on sign-in and session telemetry (last 90 days)</p>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
                {ipEntries.sort((a, b) => b[1].count - a[1].count).map(([ip, data]) => (
                  <div key={ip} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-3">
                      <Wifi className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-sm text-white font-mono">{ip}</p>
                        <p className="text-xs text-slate-500">{data.users.join(", ")}</p>
                      </div>
                    </div>
                    <span className="text-sm text-slate-400 font-medium">{data.count}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Retention & Valuation Insights */}
      <Card className="storytime-section mb-10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><TrendingUp className="w-5 h-5 text-orange-400" /> Retention & Valuation Insights</CardTitle>
          <p className="text-sm text-slate-400">Key metrics for platform valuation and user retention analysis</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="storytime-panel rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Watch / User</p>
              <p className="text-xl font-bold text-white">{Math.round((stats?.avgWatchTimePerUser ?? 0) / 60)} min</p>
            </div>
            <div className="storytime-panel rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Watchers</p>
              <p className="text-xl font-bold text-white">{stats?.uniqueWatchers ?? 0}</p>
            </div>
            <div className="storytime-panel rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Content/Creator Ratio</p>
              <p className="text-xl font-bold text-white">
                {stats?.totalContent && stats?.usersByRole
                  ? (stats.totalContent / Math.max(1, stats.usersByRole.filter((r: { role: string }) => r.role.includes("CREATOR")).reduce((s: number, r: { _count: { id: number } }) => s + r._count.id, 0))).toFixed(1)
                  : "—"}
              </p>
            </div>
            <div className="storytime-panel rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Revenue / User</p>
              <p className="text-xl font-bold text-orange-500">
                {formatZar(stats?.totalUsers ? (stats?.revenuePool ?? 0) / stats.totalUsers : 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Log */}
      {stats?.recentActivity?.length > 0 && (
        <Card className="storytime-section">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Activity className="w-5 h-5 text-violet-400" /> Recent Activity</span>
              <Link href="/admin/activity" className="text-xs font-medium text-orange-300 hover:text-orange-200">View all →</Link>
            </CardTitle>
            <p className="text-sm text-slate-400">Latest sign-ins and session telemetry (IP and device when available)</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="storytime-table text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left py-3 px-3 text-slate-400 font-medium">User</th>
                    <th className="text-left py-3 px-3 text-slate-400 font-medium">Role</th>
                    <th className="text-left py-3 px-3 text-slate-400 font-medium">IP Address</th>
                    <th className="text-left py-3 px-3 text-slate-400 font-medium">Device</th>
                    <th className="text-left py-3 px-3 text-slate-400 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.slice(0, 20).map((a: { id: string; userName?: string; userEmail?: string; role: string; ipAddress?: string; deviceType?: string; createdAt: string }) => (
                    <tr key={a.id} className="border-b border-white/6">
                      <td className="py-2.5 px-3 text-white">{a.userName || a.userEmail || "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          a.role === "ADMIN" ? "bg-orange-500/20 text-orange-400" :
                          a.role.includes("CREATOR") ? "bg-emerald-500/20 text-emerald-400" :
                          "bg-cyan-500/20 text-cyan-400"
                        }`}>
                          {a.role.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-xs">{a.ipAddress || "—"}</td>
                      <td className="py-2.5 px-3 text-slate-400">{a.deviceType || "—"}</td>
                      <td className="py-2.5 px-3 text-slate-500">{new Date(a.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
