"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clapperboard,
  Cpu,
  DollarSign,
  ExternalLink,
  Film,
  Layers,
  TrendingUp,
  Users,
} from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { AlertsPanel } from "@/components/executive/alerts-panel";
import { KpiStrip } from "@/components/executive/kpi-strip";
import { formatZar } from "@/lib/format-currency-zar";
import type { ExecutiveAlert, ExecutiveKpi, ExecutiveRelationshipChain } from "@/lib/executive/types";
import type { ExecutiveOffice } from "@/lib/executive/seat-map";

type SummaryResponse = {
  meta: {
    generatedAt: string;
    period: { key: string; label: string; start: string; end: string };
    comparePeriod: { key: string; label: string };
    freshnessLabel: string;
  };
  office: ExecutiveOffice;
  question: string;
  kpis: ExecutiveKpi[];
  alerts: ExecutiveAlert[];
  relationships: ExecutiveRelationshipChain[];
  ceo: Record<string, unknown>;
  coo: Record<string, unknown>;
  cmo: Record<string, unknown>;
  cfo: Record<string, unknown>;
  cio: Record<string, unknown>;
  shared: Record<string, unknown>;
  error?: string;
};

function Panel({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/8 bg-slate-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Icon className="h-4 w-4 text-orange-400" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium tabular-nums text-white">{value}</span>
    </div>
  );
}

function SourcePendingNote({ fields }: { fields: string[] }) {
  return (
    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
      Source pending: {fields.join(", ")} — structure ready; metrics will populate when feeds connect.
    </p>
  );
}

function RelationshipChains({ chains }: { chains: ExecutiveRelationshipChain[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {chains.map((chain) => (
        <div key={chain.id} className="rounded-lg border border-white/6 bg-slate-950/50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">{chain.label}</p>
          <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {chain.steps.map((step, i) => (
              <span key={`${chain.id}-${step}`} className="inline-flex items-center gap-1">
                <span className="rounded bg-slate-800/80 px-2 py-1 text-slate-300">{step}</span>
                {i < chain.steps.length - 1 ? <ArrowRight className="h-3 w-3 text-orange-500/60" /> : null}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CeoSection({ data }: { data: Record<string, unknown> }) {
  const topCreators = (data.topCreators as Array<{ name: string | null; revenue: number; watchTime: number }>) ?? [];
  const topTitles = (data.topTitles as Array<{ title: string; revenue: number; watchTime: number }>) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Top creators" icon={Users}>
        {topCreators.length === 0 ? (
          <p className="text-sm text-slate-500">No creator revenue data yet.</p>
        ) : (
          <ul className="space-y-2">
            {topCreators.map((c, i) => (
              <li key={i} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-slate-300">{c.name ?? "Unknown"}</span>
                <span className="shrink-0 tabular-nums text-emerald-300">{formatZar(c.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Top titles" icon={Film}>
        {topTitles.length === 0 ? (
          <p className="text-sm text-slate-500">No title revenue data yet.</p>
        ) : (
          <ul className="space-y-2">
            {topTitles.slice(0, 6).map((t, i) => (
              <li key={i} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-slate-300">{t.title}</span>
                <span className="shrink-0 tabular-nums text-orange-300">{formatZar(t.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function CooSection({ data }: { data: Record<string, unknown> }) {
  const pipeline = (data.pipeline as Record<string, number>) ?? {};
  const encode = (data.encode as { queued: number; processing: number; failed: number; ready: number }) ?? {
    queued: 0,
    processing: 0,
    failed: 0,
    ready: 0,
  };
  const opsHref = (data.opsHref as string) ?? "/admin/content";
  const [investigation, setInvestigation] = useState<{
    awaitingReview?: Array<{ id: string; title: string; reviewStatus: string; reviewHref: string }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/executive/coo/investigation")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setInvestigation(json);
      })
      .catch(() => {
        if (!cancelled) setInvestigation(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Panel
        title="Content operations"
        icon={Clapperboard}
        action={
          <Link
            href={opsHref}
            className="inline-flex items-center gap-1 text-xs text-orange-300 hover:text-orange-200"
          >
            Open content admin
            <ExternalLink className="h-3 w-3" />
          </Link>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Review pipeline</p>
            {Object.entries(pipeline).length === 0 ? (
              <p className="text-sm text-slate-500">No pipeline data.</p>
            ) : (
              Object.entries(pipeline).map(([status, count]) => (
                <StatRow key={status} label={status.replace(/_/g, " ")} value={count} />
              ))
            )}
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Encode fleet</p>
            <StatRow label="Queued" value={encode.queued} />
            <StatRow label="Processing" value={encode.processing} />
            <StatRow label="Failed" value={encode.failed} />
            <StatRow label="Ready" value={encode.ready} />
          </div>
        </div>
      </Panel>
      {investigation?.awaitingReview && investigation.awaitingReview.length > 0 ? (
        <Panel title="Awaiting review (investigation)" icon={Film}>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {investigation.awaitingReview.slice(0, 12).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-300">{row.title}</span>
                <Link href={row.reviewHref} className="shrink-0 text-xs text-orange-300 hover:text-orange-200">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function CmoSection({ data }: { data: Record<string, unknown> }) {
  const topEvents = (data.topEvents as Array<{ name: string; count: number }>) ?? [];
  const sourcePending = (data.sourcePending as string[]) ?? [];
  const funnelNote = data.funnelNote as string | undefined;

  return (
    <div className="space-y-4">
      {sourcePending.length > 0 ? <SourcePendingNote fields={sourcePending} /> : null}
      {funnelNote ? (
        <p className="text-sm text-slate-400">{funnelNote}</p>
      ) : null}
      <Panel title="Product events (30d)" icon={Activity}>
        {topEvents.length === 0 ? (
          <p className="text-sm text-slate-500">No analytics events recorded.</p>
        ) : (
          <ul className="space-y-2">
            {topEvents.map((e) => (
              <li key={e.name} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-slate-300">{e.name}</span>
                <span className="tabular-nums text-white">{e.count.toLocaleString("en-ZA")}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function CfoSection({ data }: { data: Record<string, unknown> }) {
  return (
    <Panel title="Treasury & revenue mix" icon={DollarSign}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <StatRow label="Viewer pool (MTD)" value={formatZar(Number(data.viewerPool ?? 0))} />
          <StatRow label="Creator pool" value={formatZar(Number(data.creatorPool ?? 0))} />
          <StatRow label="Platform retain" value={formatZar(Number(data.platformCut ?? 0))} />
          <StatRow
            label="Split"
            value={`${data.creatorSplitPct ?? 60}% / ${data.platformSplitPct ?? 40}%`}
          />
        </div>
        <div>
          <StatRow label="Treasury available" value={formatZar(Number(data.treasuryAvailable ?? 0))} />
          <StatRow label="Treasury pending" value={formatZar(Number(data.treasuryPending ?? 0))} />
          <StatRow label="Company subs" value={formatZar(Number(data.companySubs ?? 0))} />
          <StatRow label="Distribution licenses" value={formatZar(Number(data.distribution ?? 0))} />
          <StatRow label="Marketplace fees" value={formatZar(Number(data.marketplaceFees ?? 0))} />
          <StatRow label="Apple IAP" value={formatZar(Number(data.appleIap ?? 0))} />
          <StatRow label="Failed payments" value={Number(data.failedPayments ?? 0)} />
        </div>
      </div>
    </Panel>
  );
}

function CioSection({ data }: { data: Record<string, unknown> }) {
  const ai = data.ai as {
    totalRequests: number;
    errorRatePct: number;
    avgLatencyMs: number;
    ragHitRate: number | null;
  } | null;
  const encode = (data.encode as { queued: number; processing: number; failed: number; ready: number }) ?? {
    queued: 0,
    processing: 0,
    failed: 0,
    ready: 0,
  };
  const sourcePending = (data.sourcePending as string[]) ?? [];

  return (
    <div className="space-y-4">
      {sourcePending.length > 0 ? <SourcePendingNote fields={sourcePending} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="AI observability (24h)" icon={Cpu}>
          {ai ? (
            <>
              <StatRow label="Requests" value={ai.totalRequests.toLocaleString("en-ZA")} />
              <StatRow label="Error rate" value={`${ai.errorRatePct.toFixed(1)}%`} />
              <StatRow label="Avg latency" value={`${Math.round(ai.avgLatencyMs)} ms`} />
              <StatRow
                label="RAG hit rate"
                value={ai.ragHitRate != null ? `${(ai.ragHitRate * 100).toFixed(1)}%` : "—"}
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">AI telemetry unavailable.</p>
          )}
        </Panel>
        <Panel title="Encoding & incidents" icon={Layers}>
          <StatRow label="Encode queue" value={encode.queued} />
          <StatRow label="Processing" value={encode.processing} />
          <StatRow label="Failed" value={encode.failed} />
          <StatRow label="Open incidents" value={Number(data.openIncidents ?? 0)} />
        </Panel>
      </div>
    </div>
  );
}

function OfficeSpecificSection({ office, data }: { office: ExecutiveOffice; data: SummaryResponse }) {
  switch (office) {
    case "CEO":
      return <CeoSection data={data.ceo} />;
    case "COO":
      return <CooSection data={data.coo} />;
    case "CMO":
      return <CmoSection data={data.cmo} />;
    case "CFO":
      return <CfoSection data={data.cfo} />;
    case "CIO":
      return <CioSection data={data.cio} />;
    default:
      return null;
  }
}

export function OfficeDashboard() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/executive/summary")
      .then(async (r) => {
        const payload = (await r.json()) as SummaryResponse;
        if (!r.ok) throw new Error(payload.error ?? "Failed to load dashboard");
        return payload;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <StoryTimeLoadingCenter />;
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200">
        {error ?? "Unable to load executive summary."}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">
          {data.meta.period.label} · {data.meta.freshnessLabel}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {data.question}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Compare vs {data.meta.comparePeriod.label}
        </p>
      </div>

      <KpiStrip kpis={data.kpis} />

      <Panel title="Alerts" icon={AlertTriangle}>
        <AlertsPanel alerts={data.alerts} />
      </Panel>

      <Panel title="Relationship chains" icon={TrendingUp}>
        <RelationshipChains chains={data.relationships} />
      </Panel>

      <Panel title={`${data.office} focus`} icon={BarChart3}>
        <OfficeSpecificSection office={data.office} data={data} />
      </Panel>
    </div>
  );
}
