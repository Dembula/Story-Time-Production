"use client";

import { useEffect, useState } from "react";
import { Users, Mail, MapPin, Megaphone, Building2, ChevronDown, ChevronUp } from "lucide-react";

type Agency = {
  id: string;
  agencyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  user: { id: string; name: string | null; email: string | null };
  _count: { talent: number; inquiries: number };
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agencyDetails, setAgencyDetails] = useState<Record<string, { talent: { name: string; ageRange: string | null; skills: string | null }[] }>>({});

  useEffect(() => {
    fetch("/api/admin/cast")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function loadAgencyTalent(agencyId: string) {
    const r = await fetch(`/api/casting-agencies/${agencyId}`);
    if (r.ok) {
      const a = await r.json();
      setAgencyDetails((prev) => ({ ...prev, [agencyId]: { talent: a.talent || [] } }));
    }
  }

  if (loading || !data)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-violet-500" />
          Cast & Auditions
        </h1>
        <p className="text-slate-400">Overview of casting agencies, talent, inquiries, and audition posts</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Casting Agencies</p>
          <p className="text-2xl font-bold text-white">{data.agencyCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Total Talent</p>
          <p className="text-2xl font-bold text-white">{data.totalTalent}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Total Inquiries</p>
          <p className="text-2xl font-bold text-white">{data.inquiryCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Pending Inquiries</p>
          <p className="text-2xl font-bold text-white">{data.pendingInquiries}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Audition Posts</p>
          <p className="text-2xl font-bold text-white">{data.auditionCount}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("overview")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "overview" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
          Overview
        </button>
        <button onClick={() => setTab("agencies")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "agencies" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
          All Agencies
        </button>
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-violet-400" /> Recent Casting Agencies
            </h2>
            {data.agencies.length === 0 ? (
              <p className="text-slate-500 text-sm">No casting agencies yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.agencies.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{a.agencyName}</span>
                    <span className="text-slate-500">{a._count.talent} talent · {a._count.inquiries} inquiries</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-violet-400" /> Summary
            </h2>
            <p className="text-slate-400 text-sm mb-4">Casting agencies onboard on the platform can be discovered by creators under Creator → Cast → Find Cast. Creators send inquiries for roles; agencies manage talent and inquiries in their dashboard.</p>
            <p className="text-slate-400 text-sm">Creators can also post audition calls for their productions under Creator → Cast → Auditions.</p>
          </div>
        </div>
      )}

      {tab === "agencies" && (
        <div className="space-y-4">
          {data.agencies.length === 0 ? (
            <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center text-slate-500">No casting agencies registered yet.</div>
          ) : (
            data.agencies.map((agency) => (
              <div key={agency.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
                <button
                  onClick={() => {
                    setExpandedId(expandedId === agency.id ? null : agency.id);
                    if (expandedId !== agency.id) loadAgencyTalent(agency.id);
                  }}
                  className="w-full p-5 flex items-center justify-between text-left"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-white">{agency.agencyName}</h3>
                    {agency.tagline && <p className="text-sm text-slate-400 mt-0.5">{agency.tagline}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                      {(agency.city || agency.country) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {[agency.city, agency.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <span>{agency._count.talent} talent</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {agency._count.inquiries} inquiries</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Owner: {agency.user?.name || agency.user?.email}</p>
                  </div>
                  {expandedId === agency.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                {expandedId === agency.id && (
                  <div className="px-5 pb-5 border-t border-slate-700/50 pt-4">
                    {agency.description && <p className="text-sm text-slate-400 mb-4">{agency.description}</p>}
                    {agencyDetails[agency.id] && (
                      <div>
                        <h4 className="text-sm font-medium text-white mb-2">Talent</h4>
                        <ul className="space-y-1 text-sm text-slate-400">
                          {agencyDetails[agency.id].talent.map((t, i) => (
                            <li key={i}>{t.name}{t.ageRange ? ` · ${t.ageRange}` : ""}{t.skills ? ` · ${t.skills}` : ""}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
