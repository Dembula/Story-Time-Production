"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  Bot,
  Clapperboard,
  DollarSign,
  Download,
  Eye,
  Film,
  FolderKanban,
  Layers,
  LineChart,
  Percent,
  Radio,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModocOptional, useModoc } from "@/components/modoc";
import type { CreatorCommandCenterPayload } from "@/lib/creator-command-center";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY } from "@/lib/pricing";
import type { CreatorSuiteAccessMap } from "@/lib/creator-suite-access";
import { formatZar } from "@/lib/format-currency-zar";

type RevenueData = {
  revenue: number;
  watchTime: number;
  share: number;
  periodStart: string;
  periodEnd: string;
  totalViews: number;
  streamCount: number;
  perViewRand: number;
  perStreamRand: number;
  creatorPool: number;
  viewerSubRevenue: number;
  banking: { bankName: string; accountNumberLast4: string; accountType: string; verified: boolean } | null;
  payouts: { id: string; amount: number; currency: string; status: string; period: string; paidAt: string | null }[];
};

const RANGE_LABEL = { "7d": "Last 7 days", "30d": "Last 30 days", month: "This month", all: "All time" } as const;

function getModocMessageContent(message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts.map((p) => (p.type === "text" ? (p as { text?: string }).text ?? "" : "")).join("");
  }
  return "";
}

function CommandCenterModocModal({ onClose, prompt }: { onClose: () => void; prompt: string }) {
  const { append, messages, status, setRequestContext } = useModoc();
  const appendedRef = useRef(false);
  useEffect(() => {
    setRequestContext({
      scope: "creator-analytics",
      clientContext: "Task: creator_analytics. Command Center intelligence report.",
      pageContext: { task: "creator_analytics" },
    });
  }, [setRequestContext]);
  useEffect(() => {
    if (appendedRef.current) return;
    appendedRef.current = true;
    append({ role: "user", content: prompt });
  }, [prompt, append]);
  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  const displayContent = lastAssistant ? getModocMessageContent(lastAssistant) : "";
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" aria-hidden onClick={onClose} />
      <div
        className="storytime-section fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            Command Center AI brief
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-white/[0.05] hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-white/8 bg-white/[0.04] p-4 text-sm text-slate-200 whitespace-pre-wrap">
          {status === "streaming" || status === "submitted" ? (
            displayContent ? displayContent : <span className="text-slate-400">Generating…</span>
          ) : (
            displayContent || "Generating…"
          )}
        </div>
      </div>
    </>
  );
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
        <Icon className="w-5 h-5 text-orange-400 shrink-0" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CommandCenterClient() {
  const modoc = useModocOptional();
  const { data: licensePayload } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()),
  });
  const suite = licensePayload?.suiteAccess as CreatorSuiteAccessMap | undefined;
  const canSuite = useCallback(
    (id: keyof CreatorSuiteAccessMap) => suite == null || Boolean(suite[id]),
    [suite],
  );
  const tabAllowed = useMemo(
    () => ({
      overview: true,
      audience: canSuite("analytics"),
      films: canSuite("analytics"),
      revenue: canSuite("analytics"),
      team: canSuite("analytics"),
      ai: canSuite("analytics"),
      production: canSuite("pipeline_pre") || canSuite("pipeline_prod"),
      trends: canSuite("analytics"),
      export: canSuite("analytics"),
    }),
    [canSuite],
  );
  const [modocOpen, setModocOpen] = useState(false);
  const [tab, setTab] = useState<string>("overview");
  const [cc, setCc] = useState<CreatorCommandCenterPayload | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "quarter">("month");
  const [range, setRange] = useState<"7d" | "30d" | "month" | "all">("month");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/creator/command-center?range=${range}`).then(async (r) => (r.ok ? (await r.json()) as CreatorCommandCenterPayload : null)),
      fetch(`/api/creator/revenue?period=${period}`).then((r) => r.json()),
    ])
      .then(([cmd, rev]) => {
        setCc(cmd);
        setRevenueData(rev);
      })
      .finally(() => setLoading(false));
  }, [range, period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tabAllowed[tab as keyof typeof tabAllowed] === false) {
      setTab("overview");
    }
  }, [tab, tabAllowed]);

  const nav = useMemo(() => {
    const all = [
      { id: "overview", label: "Overview" },
      { id: "audience", label: "Audience" },
      { id: "films", label: "Films" },
      { id: "revenue", label: "Revenue" },
      { id: "team", label: "Team" },
      { id: "ai", label: "AI usage" },
      { id: "production", label: "Production" },
      { id: "trends", label: "Trends" },
      { id: "export", label: "Export" },
    ] as const;
    return all.filter((item) => tabAllowed[item.id as keyof typeof tabAllowed]);
  }, [tabAllowed]);

  const downloadCsv = useCallback(() => {
    if (!cc) return;
    const rows = cc.analytics.contentPerformance.map((c) => ({
      title: c.title,
      type: c.type,
      views: c.views,
      watchMinutes: Math.round(c.watchTimeSeconds / 60),
      comments: c.comments,
      ratings: c.ratings,
      watchlist: c.watchlistAdds,
      avgRating: c.avgRating ?? "",
    }));
    if (rows.length === 0) return;
    const header = Object.keys(rows[0]).join(",");
    const body = rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story-time-command-center-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [cc]);

  if (loading || !cc || !revenueData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const a = cc.analytics;
  const win = a.revenue;
  const eng = a.engagement;
  const contentList = a.contentPerformance;
  const trending = [...contentList]
    .map((c) => ({ ...c, score: c.views + c.comments * 5 + c.watchlistAdds * 3 }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 flex items-center gap-3 font-display text-2xl font-semibold text-white md:text-3xl">
            <Radio className="w-8 h-8 text-orange-500" />
            Command Center
          </h1>
          <p className="text-sm text-slate-300/90 md:text-base max-w-3xl">
            Decision layer for your studio: audience, monetization (ZAR), catalogue performance, production health, and AI
            assistance — wired to the same data as scheduling, control center, call sheets, and payouts.
          </p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 inline" />
            AI intelligence brief
          </Button>
        )}
      </div>
      {modoc && modocOpen && (
        <CommandCenterModocModal
          onClose={() => setModocOpen(false)}
          prompt="I am viewing the Story Time Command Center. Using revenue, engagement, content performance, projects, production incidents, call sheets, and AI usage in your context: synthesize priorities, risks, and 4 concrete next actions to grow views and ZAR."
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              tab === item.id ? "bg-orange-500 text-white" : "bg-white/[0.05] text-slate-400 hover:text-white border border-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
        <Link href="/creator/dashboard" className="ml-auto text-xs text-orange-400 hover:text-orange-300">
          My Projects →
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-slate-500 uppercase tracking-wide">Intel window</span>
          {(["7d", "30d", "month", "all"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`rounded-lg px-3 py-1.5 font-medium ${range === k ? "bg-cyan-600 text-white" : "bg-white/[0.04] text-slate-400 border border-white/10"}`}
            >
              {RANGE_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-slate-500 uppercase tracking-wide">Payout period</span>
          {(["month", "quarter"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 font-medium ${period === p ? "bg-orange-500 text-white" : "bg-white/[0.04] text-slate-400 border border-white/10"}`}
            >
              {p === "month" ? "This month" : "This quarter"}
            </button>
          ))}
        </div>
      </div>

      <Section id="overview" title="Overview (Command Center)" icon={BarChart3}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="storytime-kpi p-4 md:col-span-2">
            <p className="text-xs text-slate-400 mb-1">Total views (all-time catalogue)</p>
            <p className="text-2xl font-bold text-white">{eng.totalViews.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-1">Window views: {win.totalViews.toLocaleString()} ({RANGE_LABEL[range]})</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400 mb-1">Attributed earnings (window)</p>
            <p className="text-2xl font-bold text-emerald-300">{formatZar(win.amount)}</p>
            <p className="text-[11px] text-slate-500 mt-1">RPV {formatZar(win.perViewRand, { maximumFractionDigits: 4 })}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400 mb-1">Active projects</p>
            <p className="text-2xl font-bold text-white">{cc.overview.activeProjects}</p>
            <p className="text-[11px] text-slate-500 mt-1">Pipeline total {a.projects.total}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400 mb-1">Viewer growth (7d vs prior 7d)</p>
            <p className="text-2xl font-bold text-white">
              {cc.overview.viewerGrowth7dPct == null ? "—" : `${cc.overview.viewerGrowth7dPct > 0 ? "+" : ""}${cc.overview.viewerGrowth7dPct}%`}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {cc.overview.viewsLast7d.toLocaleString()} vs {cc.overview.viewsPrev7d.toLocaleString()} sessions
            </p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400 mb-1">Engagement index</p>
            <p className="text-2xl font-bold text-cyan-300">{cc.overview.engagementRateApprox}</p>
            <p className="text-[11px] text-slate-500 mt-1">Heuristic: comments + ratings + saves vs unique viewers</p>
          </div>
        </div>
        <div className="storytime-section p-4 flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-xs text-slate-500 uppercase">Top performer</p>
            <p className="text-white font-semibold">{cc.overview.topFilmTitle ?? "—"}</p>
            <p className="text-sm text-slate-400">
              {cc.overview.topFilmViews.toLocaleString()} views · est. window share {formatZar(cc.overview.topFilmRevenueRand)}
            </p>
          </div>
          {cc.platform && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2">
              <p className="text-xs text-amber-200/90 uppercase font-semibold">Admin · Platform (7d)</p>
              <p className="text-sm text-amber-50">Watch sessions: {cc.platform.totalWatchSessions7d.toLocaleString()}</p>
            </div>
          )}
        </div>
      </Section>

      {tabAllowed.audience ? (
      <Section id="audience" title="Viewer & engagement" icon={Users}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="storytime-kpi p-4">
            <Eye className="w-4 h-4 text-emerald-400 mb-1" />
            <p className="text-xs text-slate-400">Unique viewers</p>
            <p className="text-xl font-bold text-white">{eng.uniqueWatchers.toLocaleString()}</p>
          </div>
          <div className="storytime-kpi p-4">
            <LineChart className="w-4 h-4 text-violet-400 mb-1" />
            <p className="text-xs text-slate-400">Avg session</p>
            <p className="text-xl font-bold text-white">{eng.averageWatchTimeSeconds ? `${Math.floor(eng.averageWatchTimeSeconds / 60)}m` : "0m"}</p>
          </div>
          <div className="storytime-kpi p-4">
            <Activity className="w-4 h-4 text-sky-400 mb-1" />
            <p className="text-xs text-slate-400">Total watch time</p>
            <p className="text-xl font-bold text-white">{Math.floor(eng.totalWatchTimeSeconds / 3600)}h</p>
          </div>
          <div className="storytime-kpi p-4">
            <Percent className="w-4 h-4 text-amber-400 mb-1" />
            <p className="text-xs text-slate-400">Ratings / comments</p>
            <p className="text-xl font-bold text-white">
              {eng.totalRatings} / {eng.totalComments}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Advanced segmentation (geo, device, retention curves, drop-off maps) uses the same watch session store — UI
          placeholders until dedicated aggregation jobs ship.
        </p>
      </Section>
      ) : null}

      {tabAllowed.films ? (
      <Section id="films" title="Film performance intelligence" icon={Film}>
        <div className="storytime-section overflow-hidden">
          <div className="overflow-x-auto">
            <table className="storytime-table text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Views</th>
                  <th className="px-3 py-2">Watch time</th>
                  <th className="px-3 py-2">Engagement score</th>
                  <th className="px-3 py-2">Est. RPV</th>
                </tr>
              </thead>
              <tbody>
                {contentList.map((c) => {
                  const score = c.views + c.comments * 5 + c.ratings * 3 + c.watchlistAdds * 4;
                  const rpv = c.views > 0 ? (win.amount * (c.views / Math.max(1, win.totalViews))) / c.views : 0;
                  return (
                    <tr key={c.id} className="border-b border-white/6">
                      <td className="px-3 py-2 text-white font-medium max-w-[200px] truncate">{c.title}</td>
                      <td className="px-3 py-2">{c.views.toLocaleString()}</td>
                      <td className="px-3 py-2">{Math.floor(c.watchTimeSeconds / 60)}m</td>
                      <td className="px-3 py-2 text-cyan-200">{score.toLocaleString()}</td>
                      <td className="px-3 py-2">{formatZar(rpv, { maximumFractionDigits: 4 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-2">Trending velocity (heuristic)</p>
          <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
            {trending.map((c) => (
              <li key={c.id}>
                {c.title} — score {c.score.toLocaleString()}
              </li>
            ))}
          </ol>
        </div>
      </Section>
      ) : null}

      {tabAllowed.revenue ? (
      <Section id="revenue" title="Revenue & monetization (ZAR)" icon={DollarSign}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">Payout period earnings</p>
            <p className="text-2xl font-bold text-white">{formatZar(revenueData.revenue)}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">Viewer sub pool (window)</p>
            <p className="text-2xl font-bold text-white">{formatZar(win.viewerSubRevenue, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">Your pool share</p>
            <p className="text-2xl font-bold text-white">{win.sharePercent.toFixed(2)}%</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">RPU (rough)</p>
            <p className="text-2xl font-bold text-white">
              {formatZar(eng.uniqueWatchers > 0 ? revenueData.revenue / eng.uniqueWatchers : 0)}
            </p>
            <p className="text-[11px] text-slate-500">Earnings / unique viewer (period)</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Revenue mix (ads vs subs vs licensing) follows your live payout rules — subscription pool attribution is shown
          above. Forecasting uses manual review for now; export CSV for investor packs.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          {revenueData.banking ? (
            <>
              Payout account on file:{" "}
              <span className="text-slate-300">
                {revenueData.banking.bankName} · ••••{revenueData.banking.accountNumberLast4} · {revenueData.banking.accountType}
                {revenueData.banking.verified ? " · verified" : ""}
              </span>
              .{" "}
            </>
          ) : (
            <>No payout bank details on file yet.{" "}</>
          )}
          Add or update them in{" "}
          <Link href="/creator/account?tab=banking" className="text-orange-400 hover:underline">
            My Account → Banking & payouts
          </Link>
          .
        </p>
        <div className="storytime-section p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <ArrowDownToLine className="w-4 h-4 text-violet-400" /> Payouts
          </h3>
          {revenueData.payouts.length === 0 ? (
            <p className="text-slate-500 text-sm">No payouts yet.</p>
          ) : (
            <ul className="space-y-2">
              {revenueData.payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="text-white">{formatZar(p.amount)}</span>
                  <span className={p.status === "COMPLETED" ? "text-emerald-400" : "text-slate-500"}>{p.status}</span>
                  <span className="text-slate-500">{p.period}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
      ) : null}

      {tabAllowed.team ? (
      <Section id="team" title="Creator & team performance" icon={FolderKanban}>
        <div className="storytime-section p-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Projects</p>
            <p className="text-2xl font-bold text-white">{a.projects.total}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Phases</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(a.projects.byPhase).map(([k, v]) => (
                <span key={k} className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300">
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500">Statuses</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(a.projects.byStatus).map(([k, v]) => (
                <span key={k} className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300">
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Per-member performance cards will map from Originals membership + catalogue outcomes in a follow-up.
        </p>
      </Section>
      ) : null}

      {tabAllowed.ai ? (
      <Section id="ai" title="AI usage & assistance" icon={Bot}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">MODOC conversations ({RANGE_LABEL[range]})</p>
            <p className="text-2xl font-bold text-cyan-300">{cc.ai.modocConversationsInRange}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">User prompts sent</p>
            <p className="text-2xl font-bold text-white">{cc.ai.modocUserMessagesInRange}</p>
          </div>
          <div className="storytime-kpi p-4 md:col-span-1 col-span-2">
            <p className="text-xs text-slate-400 mb-2">Top tasks (from page context)</p>
            <ul className="text-sm text-slate-300 space-y-0.5">
              {cc.ai.topTasks.length === 0 ? (
                <li>—</li>
              ) : (
                cc.ai.topTasks.map((row) => (
                  <li key={row.task}>
                    <span className="text-orange-300">{row.task}</span> · {row.count}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Correlation of AI usage vs film success is computed offline next; session counts prove adoption today.
        </p>
      </Section>
      ) : null}

      {tabAllowed.production ? (
      <Section id="production" title="Production insights" icon={Clapperboard}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="storytime-kpi p-4">
            <Wrench className="w-4 h-4 text-slate-400 mb-1" />
            <p className="text-xs text-slate-400">Shoot days scheduled</p>
            <p className="text-2xl font-bold text-white">{cc.production.shootDaysTotal}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">Call sheets saved</p>
            <p className="text-2xl font-bold text-white">{cc.production.callSheetsSaved}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">Open incidents</p>
            <p className="text-2xl font-bold text-amber-300">{cc.production.openIncidents}</p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs text-slate-400">Tasks</p>
            <p className="text-sm text-slate-200">
              {Object.entries(cc.production.tasksByStatus)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ") || "—"}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Links to{" "}
          <Link className="text-orange-400 hover:underline" href="/creator/production/control-center">
            Production Control Center
          </Link>{" "}
          and{" "}
          <Link className="text-orange-400 hover:underline" href="/creator/production/call-sheet-generator">
            Call Sheet Generator
          </Link>{" "}
          for live execution data.
        </p>
      </Section>
      ) : null}

      {tabAllowed.trends ? (
      <Section id="trends" title="Trend & prediction" icon={Target}>
        <div className="storytime-section p-4 text-sm text-slate-300 space-y-2">
          <p>
            <TrendingUp className="w-4 h-4 inline text-orange-400 mr-1" />
            Early signal: strongest genre mix in your catalogue —{" "}
            {[...new Set(contentList.map((c) => c.type))].slice(0, 4).join(", ") || "—"}.
          </p>
          <p>
            <Layers className="w-4 h-4 inline text-cyan-400 mr-1" />
            Avg watch minutes per title:{" "}
            {contentList.length
              ? Math.round(contentList.reduce((s, c) => s + c.watchTimeSeconds / 60, 0) / contentList.length)
              : 0}{" "}
            — use with retention experiments when scene-level analytics land.
          </p>
          {a.competition && (
            <p className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Competition: {a.competition.periodName ?? "—"} · Rank #{a.competition.rank ?? "—"} · Votes {a.competition.voteCount}
            </p>
          )}
        </div>
      </Section>
      ) : null}

      {tabAllowed.export ? (
      <Section id="export" title="Export & reporting" icon={Download}>
        <div className="flex flex-wrap gap-3">
          <Button type="button" size="sm" className="bg-cyan-600 hover:bg-cyan-500" onClick={downloadCsv}>
            <Download className="w-4 h-4 mr-2 inline" />
            Download catalogue CSV
          </Button>
          <Button type="button" size="sm" variant="outline" className="border-white/20" onClick={() => window.print()}>
            Print summary
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">Investor PDF packs: print this page or export CSV and merge in your template.</p>
      </Section>
      ) : null}
    </div>
  );
}
