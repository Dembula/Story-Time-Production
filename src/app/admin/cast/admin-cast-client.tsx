"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Mail, MapPin, Megaphone, Building2, Search, ExternalLink } from "lucide-react";

type Agency = {
  id: string;
  agencyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  user: { id: string; name: string | null; email: string | null };
  _count: { talent: number; inquiries: number; invitations?: number; auditionSubmissions?: number };
  lastActivityAt?: string;
};

type Data = {
  agencies: Agency[];
  agencyCount: number;
  totalTalent: number;
  inquiryCount: number;
  pendingInquiries: number;
  auditionCount: number;
};

export function AdminCastClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "agencies">("overview");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/cast")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.agencies;
    return data.agencies.filter(
      (a) =>
        a.agencyName.toLowerCase().includes(needle) ||
        (a.user?.name || "").toLowerCase().includes(needle) ||
        (a.user?.email || "").toLowerCase().includes(needle) ||
        (a.city || "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <Users className="h-8 w-8 text-violet-500" />
          Cast & Auditions
        </h1>
        <p className="text-slate-400">Open an agency dossier for talent, inquiries, invitations, and auditions</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Casting Agencies</p>
          <p className="text-2xl font-bold text-white">{data.agencyCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Total Talent</p>
          <p className="text-2xl font-bold text-white">{data.totalTalent}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Total Inquiries</p>
          <p className="text-2xl font-bold text-white">{data.inquiryCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Pending Inquiries</p>
          <p className="text-2xl font-bold text-white">{data.pendingInquiries}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Audition Posts</p>
          <p className="text-2xl font-bold text-white">{data.auditionCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("overview")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "overview" ? "bg-orange-500 text-white" : "border border-slate-700/50 bg-slate-800/50 text-slate-400"}`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("agencies")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "agencies" ? "bg-orange-500 text-white" : "border border-slate-700/50 bg-slate-800/50 text-slate-400"}`}
        >
          All Agencies
        </button>
        <div className="relative ml-auto min-w-[200px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search agencies…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Building2 className="h-5 w-5 text-violet-400" /> Recent Casting Agencies
            </h2>
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500">No casting agencies yet.</p>
            ) : (
              <ul className="space-y-2">
                {filtered.slice(0, 10).map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/cast/${a.id}`} className="flex items-center justify-between text-sm hover:text-orange-300">
                      <span className="text-white">{a.agencyName}</span>
                      <span className="text-slate-500">
                        {a._count.talent} talent · {a._count.inquiries} inquiries
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Megaphone className="h-5 w-5 text-violet-400" /> Summary
            </h2>
            <p className="mb-4 text-sm text-slate-400">
              Agency dossiers show talent roster, creator inquiries, project invitations, and audition submissions.
            </p>
          </div>
        </div>
      )}

      {tab === "agencies" && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-8 text-center text-slate-500">
              No casting agencies match.
            </div>
          ) : (
            filtered.map((agency) => (
              <Link
                key={agency.id}
                href={`/admin/cast/${agency.id}`}
                className="block rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 transition hover:border-violet-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{agency.agencyName}</h3>
                    {agency.tagline && <p className="mt-0.5 text-sm text-slate-400">{agency.tagline}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      {(agency.city || agency.country) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {[agency.city, agency.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <span>{agency._count.talent} talent</span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {agency._count.inquiries} inquiries
                      </span>
                      {agency.lastActivityAt && (
                        <span>Last activity {new Date(agency.lastActivityAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Owner: {agency.user?.name || agency.user?.email}</p>
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
