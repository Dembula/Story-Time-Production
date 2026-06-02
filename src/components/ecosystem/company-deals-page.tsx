"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { readCompanyApiJson } from "@/lib/casting-agency-client";
import { OpsMetricCard, OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";

type DealRow = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  status: string;
  previewImageUrl?: string | null;
  createdAt: string;
  href: string;
  paid?: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  backHref: string;
  apiPath: string;
  accent?: "orange" | "emerald" | "cyan" | "violet" | "amber";
};

export function CompanyDealsPage({ title, subtitle, backHref, apiPath, accent = "orange" }: Props) {
  const [pipeline, setPipeline] = useState<DealRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(apiPath)
      .then((r) => readCompanyApiJson<{ pipeline?: DealRow[]; summary?: Record<string, number> }>(r))
      .then(({ data, error: err }) => {
        if (err) setError(err);
        setPipeline(Array.isArray(data?.pipeline) ? data.pipeline : []);
        setSummary(data?.summary ?? null);
        setLoading(false);
      });
  }, [apiPath]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <OpsPageHeader title={title} subtitle={subtitle} />
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(summary).map(([key, value]) => (
            <OpsMetricCard key={key} label={key.replace(/([A-Z])/g, " $1")} value={value} accent={accent} />
          ))}
        </div>
      )}

      <OpsSection title="Timeline">
        <div className="space-y-3">
          {pipeline.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500">No deals yet.</div>
          ) : (
            pipeline.map((d) => (
              <Link
                key={`${d.kind}-${d.id}`}
                href={d.href}
                className="flex items-start gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 hover:border-orange-500/30"
              >
                {d.previewImageUrl ? (
                  <img src={d.previewImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-xs text-slate-500">
                    —
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{d.title}</p>
                  <p className="text-sm text-slate-400">{d.subtitle}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{new Date(d.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-200">{d.status}</span>
                  {d.paid && <span className="text-[10px] text-emerald-400">Paid</span>}
                </div>
              </Link>
            ))
          )}
        </div>
      </OpsSection>
    </div>
  );
}
