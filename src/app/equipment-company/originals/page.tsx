"use client";

import { useEffect, useState } from "react";
import {
  Sparkles, Package, Film, Users, DollarSign, Target,
  ChevronDown, ChevronUp, Star, CheckCircle,
} from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";

interface Membership { id: string; role: string; department: string | null; status: string; project: { id: string; title: string; logline: string | null; type: string; genre: string | null; status: string; phase: string; budget: number | null; targetDate: string | null; posterUrl: string | null; members: { id: string; role: string; department: string | null; status: string; user: { id: string; name: string | null; role: string } }[]; _count: { members: number } } }

const STATUS_COLORS: Record<string, string> = { DEVELOPMENT: "bg-blue-500/10 text-blue-400", GREENLIT: "bg-emerald-500/10 text-emerald-400", IN_PRODUCTION: "bg-orange-500/10 text-orange-400", POST_PRODUCTION: "bg-purple-500/10 text-purple-400", COMPLETED: "bg-green-500/10 text-green-400" };

export default function EquipmentOriginalsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/originals?type=my-projects").then((r) => r.json()).then(setMemberships).finally(() => setLoading(false));
  }, []);

  async function respondInvite(memberId: string, accept: boolean) {
    await fetch("/api/originals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RESPOND_INVITE", memberId, accept }) });
    setMemberships((prev) => prev.map((m) => m.id === memberId ? { ...m, status: accept ? "ACTIVE" : "DECLINED" } : m));
  }

  const invites = memberships.filter((m) => m.status === "INVITED");
  const active = memberships.filter((m) => m.status === "ACTIVE");

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Sparkles className="w-8 h-8 text-orange-500" /> Story Time Originals</h1>
        <p className="text-slate-400">Supply equipment for Story Time Original productions. See your assigned projects and manage equipment commitments.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Active Productions</p><p className="text-2xl font-bold text-white">{active.length}</p></div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4"><p className="text-xs text-yellow-400">Pending Invitations</p><p className="text-2xl font-bold text-yellow-400">{invites.length}</p></div>
      </div>

      {invites.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5 space-y-3">
          <p className="text-white font-medium flex items-center gap-2"><Star className="w-5 h-5 text-yellow-400" /> Story Time wants your equipment for {invites.length} production{invites.length > 1 ? "s" : ""}</p>
          {invites.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
              <div>
                <p className="text-white font-medium">{m.project.title}</p>
                <p className="text-xs text-slate-500">Equipment needed: <span className="text-orange-400">{m.role}</span> · {m.project.type} · {m.project.genre}</p>
                {m.project.budget && <p className="text-xs text-slate-500">Project budget: {formatZar(m.project.budget, { maximumFractionDigits: 0 })}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => respondInvite(m.id, true)} className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium">Accept</button>
                <button onClick={() => respondInvite(m.id, false)} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-white font-semibold text-lg">Your Productions</h2>
      <div className="space-y-4">
        {active.map((m) => (
          <div key={m.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="p-5 cursor-pointer hover:bg-slate-800/70 transition" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
              <div className="flex items-start gap-4">
                {m.project.posterUrl && <img src={m.project.posterUrl} alt="" className="w-14 h-20 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-white font-semibold">{m.project.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[m.project.status] || "bg-slate-500/10 text-slate-400"}`}>{m.project.status.replace(/_/g, " ")}</span>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <p className="text-sm text-slate-400">{m.project.logline}</p>
                  <p className="text-xs text-blue-400 mt-1">Your contribution: {m.role}</p>
                </div>
                {expanded === m.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>
            {expanded === m.id && (
              <div className="border-t border-slate-700/50 p-5 bg-slate-900/30 space-y-3">
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{m.project.type} · {m.project.genre}</span>
                  <span>Phase: {m.project.phase.replace(/_/g, " ")}</span>
                  {m.project.budget && <span>Budget: {formatZar(m.project.budget, { maximumFractionDigits: 0 })}</span>}
                  {m.project.targetDate && <span>Target: {m.project.targetDate}</span>}
                </div>
                <h4 className="text-sm font-medium text-white">Full Team</h4>
                <div className="flex flex-wrap gap-2">{m.project.members.filter((mem) => mem.status === "ACTIVE").map((mem) => (<span key={mem.id} className={`text-xs px-2.5 py-1 rounded-lg border ${mem.department === "EQUIPMENT" ? "border-blue-500/30 bg-blue-500/5 text-blue-400" : "border-slate-700/50 text-slate-300"}`}>{mem.user.name} — {mem.role}</span>))}</div>
              </div>
            )}
          </div>
        ))}
        {active.length === 0 && <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center"><Package className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No active Originals productions yet. Invitations from Story Time will appear here when your equipment is needed.</p></div>}
      </div>
    </div>
  );
}
