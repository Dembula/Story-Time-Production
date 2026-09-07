"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Users, Send, MapPin, Building2, Search, ExternalLink } from "lucide-react";

type Team = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  user: { id?: string; name: string | null; email: string | null };
  _count: { members: number; requests: number; crewInvitations?: number };
  lastActivityAt?: string;
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
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/crew").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.teams;
    return data.teams.filter(
      (t) =>
        t.companyName.toLowerCase().includes(needle) ||
        (t.user?.name || "").toLowerCase().includes(needle) ||
        (t.user?.email || "").toLowerCase().includes(needle) ||
        (t.city || "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <Briefcase className="h-8 w-8 text-emerald-500" /> Crew Repository
        </h1>
        <p className="text-slate-400">Overview of crew teams — open a dossier for full roster, requests, and contracts</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Crew Teams</p>
          <p className="text-2xl font-bold text-white">{data.teamCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Total Members</p>
          <p className="text-2xl font-bold text-white">{data.totalMembers}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Total Requests</p>
          <p className="text-2xl font-bold text-white">{data.requestCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Pending</p>
          <p className="text-2xl font-bold text-white">{data.pendingRequests}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("overview")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "overview" ? "bg-orange-500 text-white" : "border border-slate-700/50 bg-slate-800/50 text-slate-400"}`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("teams")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "teams" ? "bg-orange-500 text-white" : "border border-slate-700/50 bg-slate-800/50 text-slate-400"}`}
        >
          All Teams
        </button>
        <div className="relative ml-auto min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teams…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>
      {tab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Building2 className="h-5 w-5 text-emerald-400" /> Recent Crew Teams
            </h2>
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500">No crew teams yet.</p>
            ) : (
              <ul className="space-y-2">
                {filtered.slice(0, 10).map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/crew/${t.id}`} className="flex justify-between text-sm hover:text-orange-300">
                      <span className="text-white">{t.companyName}</span>
                      <span className="text-slate-500">
                        {t._count.members} members · {t._count.requests} requests
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Users className="h-5 w-5 text-emerald-400" /> Summary
            </h2>
            <p className="text-sm text-slate-400">
              Open any team dossier to inspect roster, creator requests, project invitations, and contracts.
            </p>
          </div>
        </div>
      )}
      {tab === "teams" && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-8 text-center text-slate-500">
              No crew teams match.
            </div>
          ) : (
            filtered.map((team) => (
              <Link
                key={team.id}
                href={`/admin/crew/${team.id}`}
                className="block rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 transition hover:border-emerald-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{team.companyName}</h3>
                    {team.tagline && <p className="mt-0.5 text-sm text-slate-400">{team.tagline}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      {(team.city || team.country) && (
                        <span>
                          <MapPin className="inline h-3 w-3" /> {[team.city, team.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <span>{team._count.members} members</span>
                      <span>
                        <Send className="inline h-3 w-3" /> {team._count.requests} requests
                      </span>
                      {team.lastActivityAt && (
                        <span>Last activity {new Date(team.lastActivityAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Owner: {team.user?.name || team.user?.email}</p>
                  </div>
                  <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
