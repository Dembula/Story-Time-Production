"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Briefcase, Send, ArrowRight, DollarSign } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";

export function CrewTeamDashboardClient() {
  const [team, setTeam] = useState<{ id: string; companyName: string; _count: { members: number; requests: number } } | null>(null);
  const [requests, setRequests] = useState<{ id: string; projectName: string | null; status: string; creator: { name: string | null } }[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/crew-team").then((r) => r.json()),
      fetch("/api/crew-team/requests").then((r) => r.json()),
      fetch("/api/crew-team/stats").then((r) => r.json()),
    ]).then(([t, reqs, stats]) => {
      setTeam(t);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setRevenue(typeof stats?.revenue === "number" ? stats.revenue : 0);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!team) return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center">
        <Briefcase className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Set up your crew team profile</h2>
        <Link href="/crew-team/profile" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600">Create profile <ArrowRight className="w-4 h-4" /></Link>
      </div>
    </div>
  );

  const pending = requests.filter((r) => r.status === "PENDING").length;
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-semibold text-white mb-8">Dashboard</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <Users className="w-8 h-8 text-emerald-500 mb-3" />
          <p className="text-2xl font-bold text-white">{team._count.members}</p>
          <p className="text-sm text-slate-400">Team members</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <Send className="w-8 h-8 text-orange-500 mb-3" />
          <p className="text-2xl font-bold text-white">{team._count.requests}</p>
          <p className="text-sm text-slate-400">Total requests</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <p className="text-2xl font-bold text-white">{pending}</p>
          <p className="text-sm text-slate-400">Pending</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <DollarSign className="w-8 h-8 text-emerald-400 mb-3" />
          <p className="text-2xl font-bold text-emerald-300">{formatZar(revenue, { maximumFractionDigits: 0 })}</p>
          <p className="text-sm text-slate-400">Settled marketplace revenue</p>
        </div>
      </div>
      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 flex justify-between">
          <h2 className="text-lg font-semibold text-white">Recent requests</h2>
          <Link href="/crew-team/requests" className="text-sm text-emerald-400">View all</Link>
        </div>
        <div className="divide-y divide-slate-700/50">
          {requests.slice(0, 5).length === 0 ? <div className="p-8 text-center text-slate-500">No requests yet.</div> : requests.slice(0, 5).map((r) => (
            <div key={r.id} className="p-4 flex justify-between">
              <div><p className="font-medium text-white">{r.projectName || "Project"}</p><p className="text-sm text-slate-400">{r.creator?.name}</p></div>
              <span className={"px-3 py-1 rounded-full text-xs " + (r.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400")}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
