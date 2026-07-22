"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  Database,
  FlaskConical,
  Gauge,
  GitBranch,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_DASHBOARD_REFETCH_MS } from "@/lib/dashboard-refresh";

type NamedCount = { key: string; count: number };

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
  usage: {
    conversations: {
      total: number;
      activeInWindow: number;
      messagesInWindow: number;
      byScope: NamedCount[];
    };
    actions: { total: number; successRate: number; byAction: NamedCount[] };
    requestsByDay: Array<{ day: string; requests: number; errors: number }>;
    conversationsByDay: Array<{ day: string; conversations: number; messages: number }>;
    byUserRole: NamedCount[];
    byModel: NamedCount[];
    byIntent: NamedCount[];
    byTool: NamedCount[];
    topUsers: Array<{
      userId: string;
      name: string | null;
      email: string | null;
      role: string;
      requests: number;
      conversations: number;
      actions: number;
    }>;
    topTopics: NamedCount[];
    sessionIntel: {
      samples: number;
      avgSuggestionAcceptance: number | null;
      topIntents: NamedCount[];
      topNextBestActions: NamedCount[];
    };
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
  recentRequests: Array<{
    id: string;
    route: string;
    agentId: string | null;
    modelUsed: string | null;
    taskKind: string | null;
    userId: string | null;
    latencyMs: number;
    success: boolean;
    ragHitCount: number;
    createdAt: string;
  }>;
};

type ConversationListItem = {
  id: string;
  scope: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  actionCount: number;
  user: { id: string; name: string | null; email: string | null; role: string };
  pageContext: {
    pathname: string | null;
    projectId: string | null;
    tool: string | null;
    task: string | null;
    area: string | null;
    contentId: string | null;
  };
  lastMessage: { role: string; preview: string; createdAt: string } | null;
};

type ConversationDetail = {
  id: string;
  scope: string | null;
  createdAt: string;
  updatedAt: string;
  pageContext: Record<string, unknown> | null;
  user: { id: string; name: string | null; email: string | null; role: string; createdAt: string };
  messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
  actions: Array<{
    id: string;
    action: string;
    ok: boolean;
    message: string | null;
    projectId: string | null;
    createdAt: string;
  }>;
  sessionIntel: Array<{
    userIntent: string | null;
    nextBestAction: string | null;
    nextBestActionScore: number;
    suggestionAcceptanceRate: number;
    modelUsed: string | null;
    createdAt: string;
  }>;
  relatedRequests: Array<{
    id: string;
    route: string;
    agentId: string | null;
    modelUsed: string | null;
    taskKind: string | null;
    latencyMs: number;
    success: boolean;
    ragHitCount: number;
    createdAt: string;
  }>;
};

type TabId = "overview" | "usage" | "chats";

const WINDOW_OPTIONS = [
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
  { hours: 720, label: "30d" },
];

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

function RecordList({ title, data }: { title: string; data: Record<string, number> | NamedCount[] }) {
  const entries = Array.isArray(data)
    ? data.map((d) => [d.key, d.count] as const)
    : Object.entries(data).sort((a, b) => b[1] - a[1]);
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
  const max = Math.max(...entries.map(([, c]) => c), 1);
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-base text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {entries.map(([key, count]) => (
            <li key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate text-slate-300">{key}</span>
                <span className="ml-2 font-mono text-orange-400">{count}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-orange-500/70"
                  style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DayBars({
  title,
  rows,
  valueKey,
}: {
  title: string;
  rows: Array<Record<string, string | number>>;
  valueKey: string;
}) {
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-base text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No daily data yet.</p>
        ) : (
          <div className="flex h-36 items-end gap-1">
            {rows.map((row) => {
              const value = Number(row[valueKey]) || 0;
              const h = Math.max(4, Math.round((value / max) * 100));
              return (
                <div key={String(row.day)} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-orange-500/70 transition group-hover:bg-orange-400"
                    style={{ height: `${h}%` }}
                    title={`${row.day}: ${value}`}
                  />
                  <span className="hidden truncate text-[9px] text-slate-600 sm:block">
                    {String(row.day).slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminAiClient() {
  const [tab, setTab] = useState<TabId>("overview");
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<AiDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [chatQ, setChatQ] = useState("");
  const [chatScope, setChatScope] = useState("");
  const [chatRole, setChatRole] = useState("");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatNextCursor, setChatNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDashboard = useCallback(() => {
    fetch(`/api/admin/ai/observability?hours=${hours}`)
      .then((r) => r.json())
      .then((payload) => setData(payload))
      .finally(() => setLoading(false));
  }, [hours]);

  useEffect(() => {
    setLoading(true);
    loadDashboard();
    const timer = window.setInterval(loadDashboard, ADMIN_DASHBOARD_REFETCH_MS);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const loadChats = useCallback(
    async (opts?: { append?: boolean; cursor?: string | null }) => {
      setChatLoading(true);
      try {
        const params = new URLSearchParams();
        if (chatQ.trim()) params.set("q", chatQ.trim());
        if (chatScope) params.set("scope", chatScope);
        if (chatRole) params.set("role", chatRole);
        if (opts?.cursor) params.set("cursor", opts.cursor);
        params.set("limit", "25");
        const res = await fetch(`/api/admin/ai/conversations?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load chats");
        setConversations((prev) =>
          opts?.append ? [...prev, ...(json.conversations ?? [])] : json.conversations ?? [],
        );
        setChatNextCursor(json.nextCursor ?? null);
      } catch {
        if (!opts?.append) setConversations([]);
      } finally {
        setChatLoading(false);
      }
    },
    [chatQ, chatScope, chatRole],
  );

  useEffect(() => {
    if (tab !== "chats") return;
    void loadChats();
  }, [tab, loadChats]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/admin/ai/conversations/${selectedId}`)
      .then((r) => r.json())
      .then((json) => setDetail(json.conversation ?? null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const scopes = useMemo(() => {
    const fromUsage = data?.usage.conversations.byScope.map((s) => s.key) ?? [];
    return ["", ...fromUsage.filter((s) => s !== "unscoped")];
  }, [data]);

  if (loading && !data) return <StoryTimeLoadingCenter />;

  const s = data?.summary;
  const flags = data?.flags;
  const usage = data?.usage;

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "overview", label: "Overview", icon: Brain },
    { id: "usage", label: "Usage & purpose", icon: Activity },
    { id: "chats", label: "AI chats", icon: MessageSquare },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
            <Brain className="h-8 w-8 text-orange-500" />
            AI Operating System
          </h1>
          <p className="max-w-2xl text-slate-400">
            Platform VA / MODOC telemetry — requests, what AI is used for, account activity, and full
            chat history. Window: last {data?.windowHours ?? hours}h since{" "}
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
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/60 p-1">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.hours}
              type="button"
              onClick={() => setHours(opt.hours)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                hours === opt.hours
                  ? "bg-orange-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-orange-500/15 text-orange-200"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total AI requests" value={s?.totalRequests ?? 0} icon={Activity} />
            <MetricCard title="Avg latency" value={`${s?.avgLatencyMs ?? 0} ms`} icon={Gauge} />
            <MetricCard title="RAG hit rate" value={`${s?.ragHitRate ?? 0}%`} icon={Sparkles} />
            <MetricCard
              title="Memory cache hit rate"
              value={`${s?.memoryCacheHitRate ?? 0}%`}
              sub="From modoc/chat metadata"
              icon={Database}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Error rate" value={`${s?.errorRate ?? 0}%`} icon={Activity} />
            <MetricCard
              title="VA conversations"
              value={usage?.conversations.activeInWindow ?? 0}
              sub={`${usage?.conversations.total ?? 0} all-time`}
              icon={MessageSquare}
            />
            <MetricCard
              title="Chat messages"
              value={usage?.conversations.messagesInWindow ?? 0}
              sub="In selected window"
              icon={MessageSquare}
            />
            <MetricCard
              title="VA actions"
              value={usage?.actions.total ?? 0}
              sub={`${usage?.actions.successRate ?? 0}% success`}
              icon={Wrench}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard title="Graph edges" value={data?.graph.edgeCount ?? 0} icon={GitBranch} />
            <MetricCard title="Vector chunks" value={data?.graph.chunkCount ?? 0} icon={Database} />
            <MetricCard
              title="Suggestion accept"
              value={
                usage?.sessionIntel.avgSuggestionAcceptance != null
                  ? `${usage.sessionIntel.avgSuggestionAcceptance}%`
                  : "—"
              }
              sub={`${usage?.sessionIntel.samples ?? 0} session intel samples`}
              icon={Users}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DayBars title="AI requests / day" rows={usage?.requestsByDay ?? []} valueKey="requests" />
            <DayBars
              title="Chat messages / day"
              rows={usage?.conversationsByDay ?? []}
              valueKey="messages"
            />
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
                  <li key={agent.id} className="rounded-lg border border-white/5 bg-black/20 p-3">
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
                      <p className="text-xs text-slate-600">
                        {new Date(err.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "usage" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RecordList title="VA scope (creator / browse / …)" data={usage?.conversations.byScope ?? []} />
            <RecordList title="By account role" data={usage?.byUserRole ?? []} />
            <RecordList title="Models used" data={usage?.byModel ?? []} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RecordList title="What it’s used for (intent)" data={usage?.byIntent ?? []} />
            <RecordList title="Tools / areas in context" data={usage?.byTool ?? []} />
            <RecordList title="VA actions executed" data={usage?.actions.byAction ?? []} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecordList title="Top chat topics" data={usage?.topTopics ?? []} />
            <RecordList
              title="Next-best actions suggested"
              data={usage?.sessionIntel.topNextBestActions ?? []}
            />
          </div>

          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Users className="h-4 w-4 text-orange-500" />
                Top accounts using AI / VA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(usage?.topUsers.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No user activity in this window.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500">
                        <th className="pb-2 pr-4">Account</th>
                        <th className="pb-2 pr-4">Role</th>
                        <th className="pb-2 pr-4">Requests</th>
                        <th className="pb-2 pr-4">Chats</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage?.topUsers.map((u) => (
                        <tr key={u.userId} className="border-b border-white/5 text-slate-300">
                          <td className="py-2 pr-4">
                            <div className="font-medium text-white">{u.name || "—"}</div>
                            <div className="text-xs text-slate-500">{u.email || u.userId}</div>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">{u.role}</td>
                          <td className="py-2 pr-4">{u.requests}</td>
                          <td className="py-2 pr-4">{u.conversations}</td>
                          <td className="py-2">{u.actions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base text-white">Recent AI requests</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.recentRequests.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">No requests logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500">
                        <th className="pb-2 pr-3">When</th>
                        <th className="pb-2 pr-3">Route</th>
                        <th className="pb-2 pr-3">Agent</th>
                        <th className="pb-2 pr-3">Model</th>
                        <th className="pb-2 pr-3">Latency</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.recentRequests.map((r) => (
                        <tr key={r.id} className="border-b border-white/5 text-slate-300">
                          <td className="whitespace-nowrap py-2 pr-3 text-xs text-slate-500">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs">{r.route}</td>
                          <td className="py-2 pr-3 text-xs">{r.agentId || "—"}</td>
                          <td className="py-2 pr-3 text-xs">{r.modelUsed || "—"}</td>
                          <td className="py-2 pr-3">{r.latencyMs} ms</td>
                          <td className="py-2">
                            <span className={r.success ? "text-emerald-400" : "text-red-400"}>
                              {r.success ? "ok" : "error"}
                            </span>
                            {r.ragHitCount > 0 ? (
                              <span className="ml-2 text-xs text-sky-400">RAG {r.ragHitCount}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "chats" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <Card className="border-white/10 bg-white/[0.03]">
              <CardContent className="space-y-3 pt-5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      value={chatQ}
                      onChange={(e) => setChatQ(e.target.value)}
                      placeholder="Search name, email, chat id…"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-orange-500/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadChats()}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
                  >
                    Search
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={chatScope}
                    onChange={(e) => setChatScope(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">All scopes</option>
                    {scopes
                      .filter(Boolean)
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                  <select
                    value={chatRole}
                    onChange={(e) => setChatRole(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="">All roles</option>
                    <option value="CONTENT_CREATOR">CONTENT_CREATOR</option>
                    <option value="SUBSCRIBER">SUBSCRIBER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="FUNDER">FUNDER</option>
                    <option value="MUSIC_CREATOR">MUSIC_CREATOR</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {chatLoading && conversations.length === 0 ? (
                <p className="text-sm text-slate-500">Loading chats…</p>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-slate-500">No conversations found.</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedId === c.id
                        ? "border-orange-500/40 bg-orange-500/10"
                        : "border-white/8 bg-white/[0.03] hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {c.user.name || c.user.email || "Unknown account"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {c.user.email} · {c.user.role}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                        {c.scope || "unscoped"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                      {c.lastMessage?.preview || "No messages yet"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{c.messageCount} msgs</span>
                      <span>{c.actionCount} actions</span>
                      {c.pageContext.tool ? <span>tool: {c.pageContext.tool}</span> : null}
                      <span>{new Date(c.updatedAt).toLocaleString()}</span>
                    </div>
                  </button>
                ))
              )}
              {chatNextCursor ? (
                <button
                  type="button"
                  disabled={chatLoading}
                  onClick={() => void loadChats({ append: true, cursor: chatNextCursor })}
                  className="w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Load more
                </button>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-7">
            {!selectedId ? (
              <Card className="border-white/10 bg-white/[0.03]">
                <CardContent className="flex min-h-[320px] items-center justify-center p-8 text-sm text-slate-500">
                  Select a conversation to inspect the full VA / AI thread, account, and actions.
                </CardContent>
              </Card>
            ) : detailLoading || !detail ? (
              <Card className="border-white/10 bg-white/[0.03]">
                <CardContent className="flex min-h-[320px] items-center justify-center p-8 text-sm text-slate-500">
                  {detailLoading ? "Loading thread…" : "Conversation not found."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="border-white/10 bg-white/[0.03]">
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-white">
                        {detail.user.name || detail.user.email || "Account"}
                      </CardTitle>
                      <p className="mt-1 text-xs text-slate-500">
                        {detail.user.email} · {detail.user.role} · scope {detail.scope || "—"} ·{" "}
                        {detail.messages.length} messages
                      </p>
                      {detail.pageContext ? (
                        <p className="mt-2 font-mono text-[11px] text-slate-500">
                          {JSON.stringify(detail.pageContext)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </CardHeader>
                </Card>

                <Card className="border-white/10 bg-white/[0.03]">
                  <CardHeader>
                    <CardTitle className="text-sm text-white">Thread</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[50vh] space-y-3 overflow-y-auto">
                    {detail.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg border p-3 text-sm ${
                          m.role === "user"
                            ? "border-sky-500/20 bg-sky-500/5"
                            : m.role === "assistant"
                              ? "border-orange-500/20 bg-orange-500/5"
                              : "border-white/10 bg-black/20"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                          <span>{m.role}</span>
                          <span>{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-slate-200">{m.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {detail.actions.length > 0 && (
                  <Card className="border-white/10 bg-white/[0.03]">
                    <CardHeader>
                      <CardTitle className="text-sm text-white">VA actions in this chat</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {detail.actions.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-orange-300">{a.action}</span>
                            <span className={a.ok ? "text-emerald-400" : "text-red-400"}>
                              {a.ok ? "ok" : "failed"}
                            </span>
                          </div>
                          {a.message ? <p className="mt-1 text-slate-400">{a.message}</p> : null}
                          <p className="mt-1 text-slate-600">
                            {new Date(a.createdAt).toLocaleString()}
                            {a.projectId ? ` · project ${a.projectId}` : ""}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {detail.relatedRequests.length > 0 && (
                  <Card className="border-white/10 bg-white/[0.03]">
                    <CardHeader>
                      <CardTitle className="text-sm text-white">Related AI requests</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-slate-400">
                      {detail.relatedRequests.map((r) => (
                        <div key={r.id} className="flex flex-wrap gap-2 border-b border-white/5 py-1.5">
                          <span className="font-mono text-slate-300">{r.route}</span>
                          <span>{r.agentId || "—"}</span>
                          <span>{r.modelUsed || "—"}</span>
                          <span>{r.latencyMs} ms</span>
                          <span className={r.success ? "text-emerald-400" : "text-red-400"}>
                            {r.success ? "ok" : "error"}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
