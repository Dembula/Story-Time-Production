"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clapperboard,
  Cpu,
  DollarSign,
  ExternalLink,
  Film,
  Layers,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { AlertsPanel } from "@/components/executive/alerts-panel";
import { KpiStrip } from "@/components/executive/kpi-strip";
import { formatZar } from "@/lib/format-currency-zar";
import type { ExecutiveAlert, ExecutiveKpi, ExecutiveRelationshipChain } from "@/lib/executive/types";
import { EXECUTIVE_OFFICE_BLURBS, type ExecutiveOffice } from "@/lib/executive/seat-map";

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

function Surface({
  title,
  eyebrow,
  icon: Icon,
  children,
  action,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/70 to-slate-950/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] ${className}`.trim()}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Icon className="h-4 w-4 text-orange-400" aria-hidden />
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Meter({ label, value, max, tone = "orange" }: { label: string; value: number; max: number; tone?: "orange" | "emerald" | "red" | "sky" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar =
    tone === "emerald"
      ? "bg-emerald-400"
      : tone === "red"
        ? "bg-red-400"
        : tone === "sky"
          ? "bg-sky-400"
          : "bg-orange-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="tabular-nums text-white">{value.toLocaleString("en-ZA")}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RankList({
  rows,
}: {
  rows: Array<{ primary: string; secondary?: string; value: string }>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Nothing to show for this period yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((row, i) => (
        <li
          key={`${row.primary}-${i}`}
          className="flex items-center gap-3 rounded-xl border border-white/6 bg-slate-950/45 px-3 py-2.5"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-semibold tabular-nums text-slate-400">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-100">{row.primary}</p>
            {row.secondary ? <p className="truncate text-[11px] text-slate-500">{row.secondary}</p> : null}
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums text-orange-200">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

function RelationshipChains({ chains }: { chains: ExecutiveRelationshipChain[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {chains.map((chain) => (
        <div key={chain.id} className="rounded-xl border border-white/6 bg-slate-950/40 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">{chain.label}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {chain.steps.map((step, i) => (
              <span key={`${chain.id}-${step}`} className="inline-flex items-center gap-1.5">
                <span className="rounded-md bg-slate-800/90 px-2 py-1 text-slate-300">{step}</span>
                {i < chain.steps.length - 1 ? <ArrowRight className="h-3 w-3 text-orange-500/70" /> : null}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CeoSection({ data }: { data: Record<string, unknown> }) {
  const topCreators =
    (data.topCreators as Array<{ name: string | null; email?: string; revenue: number; watchTime: number }>) ??
    [];
  const topTitles =
    (data.topTitles as Array<{ title: string; revenue: number; watchTime: number; creatorName?: string }>) ??
    [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Surface title="Creators carrying growth" eyebrow="Portfolio" icon={Users}>
        <RankList
          rows={topCreators.map((c) => ({
            primary: c.name ?? "Unknown creator",
            secondary: `${Math.round(c.watchTime / 3600)}h eligible watch`,
            value: formatZar(c.revenue),
          }))}
        />
      </Surface>
      <Surface title="Titles driving the pool" eyebrow="Catalogue" icon={Film}>
        <RankList
          rows={topTitles.slice(0, 8).map((t) => ({
            primary: t.title,
            secondary: t.creatorName,
            value: formatZar(t.revenue),
          }))}
        />
      </Surface>
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

  const pipelineEntries = Object.entries(pipeline);
  const pipelineMax = Math.max(1, ...pipelineEntries.map(([, n]) => n));
  const encodeMax = Math.max(1, encode.queued, encode.processing, encode.failed, encode.ready);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Surface
          title="Review pipeline"
          eyebrow="Content operations"
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
          <div className="space-y-3">
            {pipelineEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No pipeline data.</p>
            ) : (
              pipelineEntries.map(([status, count]) => (
                <Meter key={status} label={status.replace(/_/g, " ")} value={count} max={pipelineMax} />
              ))
            )}
          </div>
        </Surface>
        <Surface title="Encode fleet" eyebrow="Delivery" icon={Layers}>
          <div className="space-y-3">
            <Meter label="Queued" value={encode.queued} max={encodeMax} tone="sky" />
            <Meter label="Processing" value={encode.processing} max={encodeMax} />
            <Meter label="Failed" value={encode.failed} max={encodeMax} tone="red" />
            <Meter label="Ready" value={encode.ready} max={encodeMax} tone="emerald" />
          </div>
        </Surface>
      </div>
      {investigation?.awaitingReview && investigation.awaitingReview.length > 0 ? (
        <Surface title="Needs your review" eyebrow="Investigation" icon={Film}>
          <ul className="divide-y divide-white/5">
            {investigation.awaitingReview.slice(0, 10).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-200">{row.title}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    {row.reviewStatus.replace(/_/g, " ")}
                  </p>
                </div>
                <Link
                  href={row.reviewHref}
                  className="shrink-0 rounded-lg border border-orange-500/30 px-2.5 py-1 text-xs text-orange-200 hover:bg-orange-500/10"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </div>
  );
}

function CmoSection({ data }: { data: Record<string, unknown> }) {
  const topEvents = (data.topEvents as Array<{ name: string; count: number }>) ?? [];
  const maxEvent = Math.max(1, ...topEvents.map((e) => e.count));
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Surface title="Product signal (30 days)" eyebrow="Acquisition & engagement" icon={Activity}>
        <div className="space-y-3">
          {topEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No analytics events recorded.</p>
          ) : (
            topEvents.map((e) => <Meter key={e.name} label={e.name} value={e.count} max={maxEvent} />)
          )}
        </div>
      </Surface>
      <Surface title="Growth desk notes" eyebrow="Marketing lens" icon={TrendingUp}>
        <div className="space-y-3 text-sm leading-relaxed text-slate-300">
          <p>
            Live acquisition currently reads from new subscriptions, active subscriber base, churn-risk
            sets, and product analytics events.
          </p>
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-amber-100/90">
            Campaign spend, CAC, ROAS, and LTV cohorts are scaffolded — they will light up when marketing
            cost feeds connect. Until then, treat event volume + subscriber motion as the operating pulse.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {(
              [
                ["Active subs", data.activeSubs],
                ["New (MTD)", data.newSubsMtd],
                ["Churn risk", data.churnRisk],
                ["Watchers", data.watchUniqueMtd],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/6 bg-slate-950/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                  {Number(value ?? 0).toLocaleString("en-ZA")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Surface>
    </div>
  );
}

function CfoSection({ data }: { data: Record<string, unknown> }) {
  const mix = [
    { label: "Viewer pool", value: Number(data.viewerPool ?? 0), tone: "orange" as const },
    { label: "Creator pool", value: Number(data.creatorPool ?? 0), tone: "emerald" as const },
    { label: "Platform retain", value: Number(data.platformCut ?? 0), tone: "sky" as const },
    { label: "Company subs", value: Number(data.companySubs ?? 0), tone: "orange" as const },
    { label: "Distribution", value: Number(data.distribution ?? 0), tone: "sky" as const },
    { label: "Marketplace fees", value: Number(data.marketplaceFees ?? 0), tone: "emerald" as const },
  ];
  const max = Math.max(1, ...mix.map((m) => m.value));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Surface title="Story Time economy" eyebrow="Revenue mix" icon={DollarSign}>
        <div className="space-y-3">
          {mix.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-400">{row.label}</span>
                <span className="tabular-nums text-white">{formatZar(row.value)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${
                    row.tone === "emerald" ? "bg-emerald-400" : row.tone === "sky" ? "bg-sky-400" : "bg-orange-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.round((row.value / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Surface>
      <Surface title="Treasury & risk" eyebrow="Cash posture" icon={Shield}>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Available", formatZar(Number(data.treasuryAvailable ?? 0))],
            ["Pending", formatZar(Number(data.treasuryPending ?? 0))],
            ["Apple IAP", formatZar(Number(data.appleIap ?? 0))],
            ["Failed payments", String(Number(data.failedPayments ?? 0))],
            ["Creator split", `${data.creatorSplitPct ?? 60}%`],
            ["Platform split", `${data.platformSplitPct ?? 40}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/6 bg-slate-950/50 px-3 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>
      </Surface>
    </div>
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
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Surface title="AI observability" eyebrow="Last 24 hours" icon={Cpu}>
        {ai ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Requests", ai.totalRequests.toLocaleString("en-ZA")],
              ["Error rate", `${ai.errorRatePct.toFixed(1)}%`],
              ["Avg latency", `${Math.round(ai.avgLatencyMs)} ms`],
              ["RAG hit rate", ai.ragHitRate != null ? `${(ai.ragHitRate * 100).toFixed(1)}%` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/6 bg-slate-950/50 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">AI telemetry unavailable.</p>
        )}
      </Surface>
      <Surface title="Platform health" eyebrow="Encode & incidents" icon={Layers}>
        <div className="space-y-3">
          <Meter label="Encode queue" value={encode.queued} max={Math.max(1, encode.queued, encode.processing, encode.ready)} tone="sky" />
          <Meter label="Processing" value={encode.processing} max={Math.max(1, encode.queued, encode.processing, encode.ready)} />
          <Meter label="Failed encodes" value={encode.failed} max={Math.max(1, encode.failed, 5)} tone="red" />
          <div className="rounded-xl border border-white/6 bg-slate-950/50 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Open incidents</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
              {Number(data.openIncidents ?? 0)}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            CDN error rate, TTFF, buffering, and infra cost slots are reserved for upcoming telemetry
            feeds — encode + AI + incidents are live today.
          </p>
        </div>
      </Surface>
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
      return <CmoSection data={{ ...data.cmo, ...data.shared }} />;
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
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200">
        {error ?? "Unable to load executive summary."}
      </div>
    );
  }

  const blurb = EXECUTIVE_OFFICE_BLURBS[data.office];

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 px-6 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-200">
              {data.office} office
            </span>
            <span className="text-xs text-slate-500">
              {data.meta.period.label} · {data.meta.freshnessLabel}
            </span>
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {data.question}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            {blurb} Compared against {data.meta.comparePeriod.label}.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/admin/executive/calendar"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-orange-500/30 hover:text-orange-100"
            >
              Calendar
            </Link>
            <Link
              href="/admin/executive/comms"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-orange-500/30 hover:text-orange-100"
            >
              Comms
            </Link>
            <Link
              href="/admin/executive/reports"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-orange-500/30 hover:text-orange-100"
            >
              Reports
            </Link>
          </div>
        </div>
      </header>

      <KpiStrip kpis={data.kpis} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface title="Alerts requiring attention" eyebrow="Anomalies" icon={AlertTriangle}>
          <AlertsPanel alerts={data.alerts} />
        </Surface>
        <Surface title="How the system connects" eyebrow="Cause chains" icon={TrendingUp}>
          <RelationshipChains chains={data.relationships} />
        </Surface>
      </div>

      <OfficeSpecificSection office={data.office} data={data} />
    </div>
  );
}
