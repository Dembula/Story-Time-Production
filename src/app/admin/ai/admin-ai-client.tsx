"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  Database,
  FlaskConical,
  Gauge,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_DASHBOARD_REFETCH_MS } from "@/lib/dashboard-refresh";

type AiDashboardData = {
  since: string;
  windowHours: number;
  flags: {
    ragEnabled: boolean;
    hybridRecommendations: boolean;
    memoryCacheEnabled: boolean;
    abTestingEnabled: boolean;
    redisConfigured: boolean;
  };
  summary: {
    totalRequests: number;
    avgLatencyMs: number;
    ragHitRate: number;
    errorRate: number;
    memoryCacheHitRate: number;
    byAgent: Record<string, number>;
    byRoute: Record<string, number>;
    byTaskKind: Record<string, number>;
  };
  abEvaluation: {
    enabled: boolean;
    recommendation: string;
    rows: Array<{
      variant: string;
      modelUsed: string | null;
      requestCount: number;
      avgLatencyMs: number;
      errorRate: number;
      ragHitRate: number;
    }>;
  };
  activeAgents: Array<{ id: string; name: string; description: string }>;
  graph: { edgeCount: number; chunkCount: number };
  recentErrors: Array<{
    route: string;
    agentId: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

function FlagBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        on ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/50 text-slate-400"
      }`}
    >
      {label}: {on ? "on" : "off"}
    </span>
  );
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        <Icon className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-white">{value}</div>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function RecordList({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">No data in this window.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-base text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {entries.map(([key, count]) => (
            <li key={key} className="flex items-center justify-between text-sm">
              <span className="truncate text-slate-300">{key}</span>
              <span className="ml-2 font-mono text-orange-400">{count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AdminAiClient() {
  const [data, setData] = useState<AiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/admin/ai/observability?hours=24")
        .then((r) => r.json())
        .then((payload) => {
          if (!cancelled) setData(payload);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const timer = window.setInterval(load, ADMIN_DASHBOARD_REFETCH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return <StoryTimeLoadingCenter />;

  const s = data?.summary;
  const flags = data?.flags;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <Brain className="h-8 w-8 text-orange-500" />
          AI Operating System
        </h1>
        <p className="text-slate-400">
          Observability for MODOC orchestration, specialist agents, RAG, knowledge graph, and A/B
          model evaluation — last {data?.windowHours ?? 24}h since{" "}
          {data?.since ? new Date(data.since).toLocaleString() : "—"}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {flags && (
            <>
              <FlagBadge on={flags.ragEnabled} label="RAG" />
              <FlagBadge on={flags.hybridRecommendations} label="Hybrid recs" />
              <FlagBadge on={flags.memoryCacheEnabled} label="Memory cache" />
              <FlagBadge on={flags.abTestingEnabled} label="A/B testing" />
              <FlagBadge on={flags.redisConfigured} label="Redis" />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total AI requests" value={s?.totalRequests ?? 0} icon={Activity} />
        <MetricCard
          title="Avg latency"
          value={`${s?.avgLatencyMs ?? 0} ms`}
          icon={Gauge}
        />
        <MetricCard
          title="RAG hit rate"
          value={`${s?.ragHitRate ?? 0}%`}
          icon={Sparkles}
        />
        <MetricCard
          title="Memory cache hit rate"
          value={`${s?.memoryCacheHitRate ?? 0}%`}
          sub="From modoc/chat metadata"
          icon={Database}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Error rate" value={`${s?.errorRate ?? 0}%`} icon={Activity} />
        <MetricCard title="Graph edges" value={data?.graph.edgeCount ?? 0} icon={GitBranch} />
        <MetricCard title="Vector chunks" value={data?.graph.chunkCount ?? 0} icon={Database} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecordList title="Requests by agent" data={s?.byAgent ?? {}} />
        <RecordList title="Requests by route" data={s?.byRoute ?? {}} />
        <RecordList title="Requests by task kind" data={s?.byTaskKind ?? {}} />
      </div>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Bot className="h-4 w-4 text-orange-500" />
            Active specialist agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 md:grid-cols-2">
            {(data?.activeAgents ?? []).map((agent) => (
              <li
                key={agent.id}
                className="rounded-lg border border-white/5 bg-black/20 p-3"
              >
                <p className="font-medium text-white">{agent.name}</p>
                <p className="text-xs text-slate-500">{agent.id}</p>
                <p className="mt-1 text-sm text-slate-400">{agent.description}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <FlaskConical className="h-4 w-4 text-orange-500" />
            A/B model evaluation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">{data?.abEvaluation.recommendation}</p>
          {(data?.abEvaluation.rows.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500">No A/B traffic logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500">
                    <th className="pb-2 pr-4">Variant</th>
                    <th className="pb-2 pr-4">Model</th>
                    <th className="pb-2 pr-4">Requests</th>
                    <th className="pb-2 pr-4">Avg latency</th>
                    <th className="pb-2 pr-4">Errors</th>
                    <th className="pb-2">RAG hits</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.abEvaluation.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 text-slate-300">
                      <td className="py-2 pr-4 font-mono text-xs">{row.variant}</td>
                      <td className="py-2 pr-4">{row.modelUsed ?? "—"}</td>
                      <td className="py-2 pr-4">{row.requestCount}</td>
                      <td className="py-2 pr-4">{row.avgLatencyMs} ms</td>
                      <td className="py-2 pr-4">{row.errorRate}%</td>
                      <td className="py-2">{row.ragHitRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {(data?.recentErrors.length ?? 0) > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-base text-red-300">Recent AI errors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data?.recentErrors.map((err, i) => (
                <li key={i} className="rounded border border-red-500/10 bg-black/20 p-2">
                  <span className="font-mono text-xs text-red-400">{err.route}</span>
                  {err.agentId && (
                    <span className="ml-2 text-xs text-slate-500">{err.agentId}</span>
                  )}
                  <p className="mt-1 text-slate-400">{err.errorMessage ?? "Unknown error"}</p>
                  <p className="text-xs text-slate-600">{new Date(err.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
