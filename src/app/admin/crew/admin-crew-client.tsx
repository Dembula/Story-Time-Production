"use client";

import { useEffect, useState } from "react";
import { Briefcase, Users, Send, MapPin, Building2, ChevronDown, ChevronUp } from "lucide-react";

type Team = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  user: { name: string | null; email: string | null };
  _count: { members: number; requests: number };
};

type Data = {
  teams: Team[];
  teamCount: number;
  totalMembers: number;
  requestCount: number;
  pendingRequests: number;
};

export function AdminCrewClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "teams">("overview");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [teamDetails, setTeamDetails] = useState<Record<string, { members: { name: string; role: string }[] }>>({});

  useEffect(() => {
    fetch("/api/admin/crew").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  async function loadTeamMembers(teamId: string) {
    const r = await fetch(`/api/crew-teams/${teamId}`);
    if (r.ok) {
      const t = await r.json();
      setTeamDetails((prev) => ({ ...prev, [teamId]: { members: t.members || [] } }));
    }
  }

  if (loading || !data) return (
    <div className="flex justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Briefcase className="w-8 h-8 text-emerald-500" /> Crew Repository</h1>
        <p className="text-slate-400">Overview of crew teams, members, and creator requests</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Crew Teams</p><p className="text-2xl font-bold text-white">{data.teamCount}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Members</p><p className="text-2xl font-bold text-white">{data.totalMembers}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Requests</p><p className="text-2xl font-bold text-white">{data.requestCount}</p></div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Pending</p><p className="text-2xl font-bold text-white">{data.pendingRequests}</p></div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setTab("overview")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "overview" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>Overview</button>
        <button onClick={() => setTab("teams")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "teams" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>All Teams</button>
      </div>
      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-emerald-400" /> Recent Crew Teams</h2>
            {data.teams.length === 0 ? <p className="text-slate-500 text-sm">No crew teams yet.</p> : (
              <ul className="space-y-2">
                {data.teams.slice(0, 10).map((t) => (
                  <li key={t.id} className="flex justify-between text-sm"><span className="text-white">{t.companyName}</span><span className="text-slate-500">{t._count.members} members · {t._count.requests} requests</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-emerald-400" /> Summary</h2>
            <p className="text-slate-400 text-sm">Crew teams are discoverable by creators under Creator → Crew → Find Crew Teams. Creators send requests; teams manage them in their dashboard.</p>
          </div>
        </div>
      )}
      {tab === "teams" && (
        <div className="space-y-4">
          {data.teams.length === 0 ? <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center text-slate-500">No crew teams yet.</div> : data.teams.map((team) => (
            <div key={team.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
              <button onClick={() => { setExpandedId(expandedId === team.id ? null : team.id); if (expandedId !== team.id) loadTeamMembers(team.id); }} className="w-full p-5 flex items-center justify-between text-left">
                <div>
                  <h3 className="text-lg font-semibold text-white">{team.companyName}</h3>
                  {team.tagline && <p className="text-sm text-slate-400 mt-0.5">{team.tagline}</p>}
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    {(team.city || team.country) && <span><MapPin className="w-3 h-3 inline" /> {[team.city, team.country].filter(Boolean).join(", ")}</span>}
                    <span>{team._count.members} members</span>
                    <span><Send className="w-3 h-3 inline" /> {team._count.requests} requests</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Owner: {team.user?.name || team.user?.email}</p>
                </div>
                {expandedId === team.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              {expandedId === team.id && teamDetails[team.id] && (
                <div className="px-5 pb-5 border-t border-slate-700/50 pt-4">
                  {team.description && <p className="text-sm text-slate-400 mb-4">{team.description}</p>}
                  <h4 className="text-sm font-medium text-white mb-2">Team members</h4>
                  <ul className="space-y-1 text-sm text-slate-400">
                    {teamDetails[team.id].members.map((m, i) => <li key={i}>{m.name} · {m.role}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
