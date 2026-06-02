"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Mail, UserCheck } from "lucide-react";
import { readCastingApiJson } from "@/lib/casting-agency-client";
import { OpsMetricCard, OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";

type DealRow = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  status: string;
  talentName: string | null;
  createdAt: string;
  href: string;
};

type Summary = {
  inquiries: number;
  invitations: number;
  contracts: number;
  pendingInquiries: number;
  pendingInvitations: number;
  signedContracts: number;
};

export default function CastingAgencyDealsPage() {
  const [pipeline, setPipeline] = useState<DealRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "INQUIRY" | "INVITATION" | "CONTRACT">("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/casting-agency/deals")
      .then((r) => readCastingApiJson<{ pipeline?: DealRow[]; summary?: Summary }>(r))
      .then(({ data, error: loadErr }) => {
        if (loadErr) setError(loadErr);
        setPipeline(Array.isArray(data?.pipeline) ? data.pipeline : []);
        setSummary(data?.summary ?? null);
        setLoading(false);
      });
  }, []);

  const rows = filter === "ALL" ? pipeline : pipeline.filter((r) => r.kind === filter);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <OpsPageHeader
        title="Deal pipeline"
        subtitle="Every inquiry, project invitation, and platform contract for your represented talent — in one timeline."
      />
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OpsMetricCard label="Inquiries" value={summary.inquiries} accent="amber" sub={`${summary.pendingInquiries} pending`} />
          <OpsMetricCard label="Invitations" value={summary.invitations} accent="violet" sub={`${summary.pendingInvitations} pending`} />
          <OpsMetricCard label="Contracts" value={summary.contracts} accent="cyan" sub={`${summary.signedContracts} signed`} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["ALL", "INQUIRY", "INVITATION", "CONTRACT"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${filter === f ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-400"}`}
          >
            {f === "ALL" ? "All" : f.toLowerCase()}
          </button>
        ))}
      </div>

      <OpsSection title="Timeline">
        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500">No deals in this view yet.</div>
          ) : (
            rows.map((d) => (
              <Link
                key={`${d.kind}-${d.id}`}
                href={d.href}
                className="flex items-start justify-between gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 hover:border-violet-500/30"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium text-white">
                    {d.kind === "INQUIRY" && <Mail className="h-4 w-4 text-amber-400" />}
                    {d.kind === "INVITATION" && <UserCheck className="h-4 w-4 text-violet-400" />}
                    {d.kind === "CONTRACT" && <FileText className="h-4 w-4 text-cyan-400" />}
                    {d.title}
                  </p>
                  <p className="text-sm text-slate-400">{d.subtitle}</p>
                  {d.talentName && <p className="mt-1 text-xs text-violet-300">Talent: {d.talentName}</p>}
                  <p className="mt-1 text-[11px] text-slate-500">{new Date(d.createdAt).toLocaleString()}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-200">{d.status}</span>
              </Link>
            ))
          )}
        </div>
      </OpsSection>
    </div>
  );
}
