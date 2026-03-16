"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Film } from "lucide-react";

type AgencyContract = {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  createdAt: string;
  project: { id: string; title: string | null } | null;
  talent: { id: string; name: string } | null;
  version: { id: string; version: number; createdAt: string } | null;
};

export default function CastingAgencyContractsPage() {
  const [contracts, setContracts] = useState<AgencyContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/casting-agency/contracts")
      .then((r) => r.json())
      .then((arr) => {
        setContracts(Array.isArray(arr) ? arr : []);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="flex justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Contracts for your talent</h1>
        <p className="text-xs text-slate-400">View contracts Story Time creators have shared for your represented actors.</p>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-10 text-center text-slate-500 text-sm">
          No contracts yet. When creators generate actor contracts and link them to your talent, they will appear here.
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map((c) => (
            <div key={c.id} className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-400" />
                  <p className="text-sm text-slate-300">
                    {c.type} contract {c.talent ? `for ${c.talent.name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Film className="w-3 h-3" />
                  <span>{c.project?.title ?? "Untitled project"}</span>
                </div>
                {c.subject && <p className="text-xs text-slate-300 mt-1">{c.subject}</p>}
                <p className="text-[11px] text-slate-500 mt-1">
                  Created {new Date(c.createdAt).toLocaleDateString()}
                  {c.version && ` · v${c.version.version}`}
                </p>
              </div>
              <span
                className={
                  "px-3 py-1 rounded-full text-xs font-medium " +
                  (c.status === "SIGNED"
                    ? "bg-green-500/15 text-green-300"
                    : c.status === "DRAFT"
                    ? "bg-slate-500/20 text-slate-200"
                    : "bg-amber-500/15 text-amber-300")
                }
              >
                {c.status || "DRAFT"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

