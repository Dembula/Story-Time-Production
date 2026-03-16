"use client";

import { useEffect, useState } from "react";
import {
  Activity, Users, Clock, Globe, Monitor, Shield, Search, Filter,
  LogIn, Eye, MessageSquare, Star, Wifi, TrendingUp,
} from "lucide-react";

interface ActivityEntry {
  id: string;
  userName: string | null;
  userEmail: string | null;
  role: string;
  eventType: string;
  ipAddress: string | null;
  deviceType: string | null;
  createdAt: string;
}

interface ActivityData {
  activity: ActivityEntry[];
  signInsByRole: { role: string; _count: { id: number } }[];
  totalWatchTimeSeconds: number;
  totalComments: number;
  totalRatings: number;
  uniqueIPs: number;
  deviceBreakdown: Record<string, number>;
  ipBreakdown: Record<string, { count: number; users: string[] }>;
  hourlyDistribution: Record<string, number>;
}

export function AdminActivityClient() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/activity").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  const activity = data?.activity || [];
  const signIns = data?.signInsByRole || [];
  const totalWatchHours = Math.floor((data?.totalWatchTimeSeconds || 0) / 3600);
  const deviceEntries = Object.entries(data?.deviceBreakdown || {}).sort((a, b) => b[1] - a[1]);
  const ipEntries = Object.entries(data?.ipBreakdown || {}).sort((a, b) => b[1].count - a[1].count);
  const hourlyEntries = Object.entries(data?.hourlyDistribution || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxHourly = Math.max(...hourlyEntries.map(([, v]) => v), 1);

  const filteredActivity = activity.filter((a) => {
    const matchesRole = roleFilter === "ALL" || a.role === roleFilter;
    const matchesSearch = !search || a.userName?.toLowerCase().includes(search.toLowerCase()) || a.userEmail?.toLowerCase().includes(search.toLowerCase()) || a.ipAddress?.includes(search);
    return matchesRole && matchesSearch;
  });

  const roles = [...new Set(activity.map((a) => a.role))];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Activity className="w-8 h-8 text-orange-500" /> Platform Activity Intelligence</h1>
        <p className="text-slate-400">Complete audit trail — every sign-in, device, IP address, engagement metric, and time-of-day pattern.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Sign-ins", value: activity.length, icon: LogIn, color: "text-cyan-400" },
          { label: "Watch Hours", value: `${totalWatchHours}h`, icon: Clock, color: "text-violet-400" },
          { label: "Total Comments", value: data?.totalComments || 0, icon: MessageSquare, color: "text-blue-400" },
          { label: "Total Ratings", value: data?.totalRatings || 0, icon: Star, color: "text-yellow-400" },
          { label: "Unique IPs", value: data?.uniqueIPs || 0, icon: Globe, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-slate-400">{s.label}</span></div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sign-ins by Role */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-cyan-400" /> Sign-ins by Role</h3>
          <div className="space-y-2">
            {signIns.map((r) => {
              const total = signIns.reduce((s, x) => s + (x._count?.id || 0), 0);
              const pct = total > 0 ? ((r._count?.id || 0) / total) * 100 : 0;
              const colorMap: Record<string, string> = { SUBSCRIBER: "bg-cyan-500", CONTENT_CREATOR: "bg-emerald-500", MUSIC_CREATOR: "bg-pink-500", EQUIPMENT_COMPANY: "bg-blue-500", ADMIN: "bg-orange-500" };
              return (
                <div key={r.role}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{r.role.replace(/_/g, " ")}</span><span className="text-white font-medium">{r._count?.id || 0} ({pct.toFixed(0)}%)</span></div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden"><div className={`h-full rounded-full ${colorMap[r.role] || "bg-slate-500"}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Monitor className="w-4 h-4 text-blue-400" /> Device Breakdown</h3>
          <div className="space-y-2">
            {deviceEntries.map(([device, count]) => {
              const total = deviceEntries.reduce((s, [, c]) => s + c, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={device}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{device}</span><span className="text-white font-medium">{count} ({pct.toFixed(0)}%)</span></div>
                  <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden"><div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* IP Addresses */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Wifi className="w-4 h-4 text-emerald-400" /> IP Address Intelligence</h3>
          <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {ipEntries.map(([ip, info]) => (
              <div key={ip} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <div><p className="text-sm text-white font-mono">{ip}</p><p className="text-xs text-slate-500">{info.users.join(", ")}</p></div>
                <span className="text-sm text-slate-400 font-medium">{info.count}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity by Hour */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-400" /> Activity by Hour</h3>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 24 }, (_, i) => {
              const count = Number(hourlyEntries.find(([h]) => Number(h) === i)?.[1] || 0);
              const height = maxHourly > 0 ? (count / maxHourly) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${i}:00 — ${count} events`}>
                  <div className="w-full bg-slate-700/50 rounded-t relative" style={{ height: "100%" }}>
                    <div className="absolute bottom-0 w-full bg-orange-500/60 rounded-t transition-all" style={{ height: `${height}%` }} />
                  </div>
                  {i % 4 === 0 && <span className="text-[10px] text-slate-500">{i}h</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full Activity Log */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700/50 flex items-center gap-3 flex-wrap">
          <h3 className="text-white font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-orange-400" /> Full Activity Audit Log</h3>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-xs">
              <option value="ALL">All Roles</option>
              {roles.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-7 pr-3 py-1.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-xs w-48" />
            </div>
            <span className="text-xs text-slate-500">{filteredActivity.length} events</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-800"><tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">User</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Email</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Role</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Event</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">IP Address</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Device</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Timestamp</th>
            </tr></thead>
            <tbody>
              {filteredActivity.map((a) => {
                const roleColor: Record<string, string> = { ADMIN: "bg-red-500/20 text-red-400", CONTENT_CREATOR: "bg-emerald-500/20 text-emerald-400", MUSIC_CREATOR: "bg-pink-500/20 text-pink-400", EQUIPMENT_COMPANY: "bg-blue-500/20 text-blue-400", SUBSCRIBER: "bg-slate-700 text-slate-400" };
                return (
                  <tr key={a.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-white">{a.userName || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-xs">{a.userEmail || "—"}</td>
                    <td className="py-2.5 px-4"><span className={`px-2 py-0.5 rounded text-xs font-medium ${roleColor[a.role] || roleColor.SUBSCRIBER}`}>{a.role.replace(/_/g, " ")}</span></td>
                    <td className="py-2.5 px-4"><span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 text-xs">{a.eventType}</span></td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-xs">{a.ipAddress || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-xs">{a.deviceType || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-500 text-xs">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
