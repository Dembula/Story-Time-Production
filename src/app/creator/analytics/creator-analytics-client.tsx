"use client";

import { useEffect, useState, useRef } from "react";
import {
  DollarSign,
  TrendingUp,
  Eye,
  Clock,
  Percent,
  Building2,
  CreditCard,
  ArrowDownToLine,
  BarChart3,
  Users,
  MessageSquare,
  Film,
  FolderKanban,
  Trophy,
  Bookmark,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModocOptional, useModoc } from "@/components/modoc";

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

type CreatorAnalyticsPayload = {
  rangeKey: "7d" | "30d" | "month" | "all";
  period: { start: string; end: string };
  revenue: {
    amount: number;
    watchTimeSeconds: number;
    sharePercent: number;
    totalViews: number;
    streamCount: number;
    perViewRand: number;
    perStreamRand: number;
    creatorPool: number;
    viewerSubRevenue: number;
  };
  engagement: {
    totalViews: number;
    uniqueWatchers: number;
    averageWatchTimeSeconds: number;
    totalWatchTimeSeconds: number;
    totalComments: number;
    totalRatings: number;
    watchlistCount: number;
    contentCount: number;
  };
  contentPerformance: Array<{
    id: string;
    title: string;
    type: string;
    views: number;
    watchTimeSeconds: number;
    comments: number;
    ratings: number;
    watchlistAdds: number;
    avgRating: number | null;
  }>;
  projects: { total: number; byPhase: Record<string, number>; byStatus: Record<string, number> };
  competition: { periodName: string | null; endDate: string | null; rank: number | null; voteCount: number } | null;
};

const RANGE_LABEL: Record<CreatorAnalyticsPayload["rangeKey"], string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month (calendar)",
  all: "All time",
};

function getModocMessageContent(message: { content?: string; parts?: Array<{ type: string; text?: string }> }): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((p) => (p.type === "text" ? (p as { text?: string }).text ?? "" : ""))
      .join("");
  }
  return "";
}

function CreatorAnalyticsModocModal({
  onClose,
  prompt,
}: {
  onClose: () => void;
  prompt: string;
}) {
  const { append, messages, status, setRequestContext } = useModoc();
  const appendedRef = useRef(false);

  useEffect(() => {
    setRequestContext({
      scope: "creator-analytics",
      clientContext: "Task: creator_analytics. Analytics report requested.",
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
            MODOC analytics report
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
            displayContent ? displayContent : <span className="text-slate-400">MODOC is working…</span>
          ) : (
            displayContent || "Waiting for MODOC…"
          )}
        </div>
      </div>
    </>
  );
}

export function CreatorAnalyticsClient() {
  const modoc = useModocOptional();
  const [modocReportOpen, setModocReportOpen] = useState(false);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [analytics, setAnalytics] = useState<CreatorAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "quarter">("month");
  const [analyticsRange, setAnalyticsRange] = useState<CreatorAnalyticsPayload["rangeKey"]>("month");
  const [bankForm, setBankForm] = useState({ bankName: "", accountNumber: "", accountType: "CHEQUE", branchCode: "" });
  const [submittingBank, setSubmittingBank] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/creator/revenue?period=${period}`).then((r) => r.json()),
      fetch(`/api/creator/analytics?range=${analyticsRange}`).then(async (r) => {
        const data = await r.json();
        return r.ok && data?.period ? data : null;
      }),
    ])
      .then(([revenue, analyticsData]) => {
        if (cancelled) return;
        setRevenueData(revenue);
        setAnalytics(analyticsData ?? null);
      })
      .catch(() => {
        if (!cancelled) setRevenueData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, analyticsRange]);

  async function submitBank(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingBank(true);
    try {
      const res = await fetch("/api/creator/banking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      if (res.ok) {
        setBankForm({ bankName: "", accountNumber: "", accountType: "CHEQUE", branchCode: "" });
        const d = await fetch(`/api/creator/revenue?period=${period}`).then((r) => r.json());
        setRevenueData(d);
      }
    } finally {
      setSubmittingBank(false);
    }
  }

  if (loading || !revenueData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const data = revenueData;
  const eng = analytics?.engagement;
  const win = analytics?.revenue;
  const contentList = analytics?.contentPerformance ?? [];
  const projects = analytics?.projects;
  const competition = analytics?.competition;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 flex items-center gap-3 font-display text-2xl font-semibold text-white md:text-3xl">
            <BarChart3 className="w-8 h-8 text-orange-500" /> Analytics
          </h1>
          <p className="text-sm text-slate-300/78 md:text-base">
            Performance across your account and movies: revenue, audience, content, projects, and competition.
          </p>
        </div>
        {modoc && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10 text-xs shrink-0"
            onClick={() => setModocReportOpen(true)}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5 inline" />
            Get MODOC analytics report
          </Button>
        )}
      </div>
      {modoc && modocReportOpen && (
        <CreatorAnalyticsModocModal
          onClose={() => setModocReportOpen(false)}
          prompt="Using my analytics data in your context, give me a clear report: what do these stats mean, how do they tie together (revenue, views, engagement, content performance, projects), and what are 2–4 actionable next steps I can take?"
        />
      )}

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Payout & revenue period</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPeriod("month")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${period === "month" ? "bg-orange-500 text-white shadow-glow" : "border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.05]"}`}
          >
            This month
          </button>
          <button
            type="button"
            onClick={() => setPeriod("quarter")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${period === "quarter" ? "bg-orange-500 text-white shadow-glow" : "border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.05]"}`}
          >
            This quarter
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Earnings, banking, and payout figures use this period. It may differ from the analytics window below.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Analytics window</p>
        <div className="flex flex-wrap gap-2">
          {(["7d", "30d", "month", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setAnalyticsRange(key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${analyticsRange === key ? "bg-cyan-600/90 text-white shadow-glow" : "border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.05]"}`}
            >
              {RANGE_LABEL[key]}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Window snapshot and pool math for views/streams use this range. Engagement and the content table stay all-time.
        </p>
      </div>

      {win && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" /> Window snapshot
            <span className="text-xs font-normal text-slate-500">({RANGE_LABEL[analytics?.rangeKey ?? "month"]})</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-slate-400">Attributed earnings</span>
              </div>
              <p className="text-2xl font-bold text-white">R{win.amount.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Share in this window</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-400">Views</span>
              </div>
              <p className="text-2xl font-bold text-white">{win.totalViews.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">R{win.perViewRand.toFixed(4)} per view</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-slate-400">Watch time</span>
              </div>
              <p className="text-2xl font-bold text-white">{Math.floor(win.watchTimeSeconds / 3600)}h</p>
              <p className="text-xs text-slate-500 mt-1">R{win.perStreamRand.toFixed(2)} per stream</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-400">Share of pool</span>
              </div>
              <p className="text-2xl font-bold text-white">{win.sharePercent.toFixed(2)}%</p>
              <p className="text-xs text-slate-500 mt-1">Creator pool R{win.creatorPool.toFixed(2)}</p>
            </div>
          </div>
        </section>
      )}

      {/* Revenue (payout period) */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-orange-400" /> Revenue
          <span className="text-xs font-normal text-slate-500">(payout period)</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="storytime-kpi p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-slate-400">Earnings</span>
            </div>
            <p className="text-2xl font-bold text-white">R{data.revenue.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {data.periodStart?.slice(0, 7)} – {data.periodEnd?.slice(0, 10)}
            </p>
          </div>
          <div className="storytime-kpi p-5">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Views</span>
            </div>
            <p className="text-2xl font-bold text-white">{data.totalViews.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">R{data.perViewRand.toFixed(4)} per view</p>
          </div>
          <div className="storytime-kpi p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-slate-400">Watch time</span>
            </div>
            <p className="text-2xl font-bold text-white">{Math.floor(data.watchTime / 3600)}h</p>
            <p className="text-xs text-slate-500 mt-1">R{data.perStreamRand.toFixed(2)} per stream</p>
          </div>
          <div className="storytime-kpi p-5">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">Share of pool</span>
            </div>
            <p className="text-2xl font-bold text-white">{data.share.toFixed(2)}%</p>
            <p className="text-xs text-slate-500 mt-1">Creator pool R{data.creatorPool.toFixed(2)}</p>
          </div>
        </div>
      </section>

      {eng && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" /> Engagement & audience
            <span className="text-xs font-normal text-slate-500">(all-time)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-400">Total views</span>
              </div>
              <p className="text-2xl font-bold text-white">{eng.totalViews.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">All-time watch sessions</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-400">Unique viewers</span>
              </div>
              <p className="text-2xl font-bold text-white">{eng.uniqueWatchers.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">People who watched your work</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-slate-400">Avg session</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {eng.averageWatchTimeSeconds ? `${Math.floor(eng.averageWatchTimeSeconds / 60)}m` : "0m"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Time per view</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span className="text-xs text-slate-400">Comments</span>
              </div>
              <p className="text-2xl font-bold text-white">{eng.totalComments.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Conversation & feedback</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-slate-400">Ratings</span>
              </div>
              <p className="text-2xl font-bold text-white">{eng.totalRatings.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Total ratings</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bookmark className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-400">Watchlist adds</span>
              </div>
              <p className="text-2xl font-bold text-white">{eng.watchlistCount.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Saved by viewers</p>
            </div>
            <div className="storytime-kpi p-5">
              <div className="flex items-center gap-2 mb-2">
                <Film className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400">Titles</span>
              </div>
              <p className="text-2xl font-bold text-white">{eng.contentCount}</p>
              <p className="text-xs text-slate-500 mt-1">Content pieces</p>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Film className="w-5 h-5 text-violet-400" /> Content performance
          <span className="text-xs font-normal text-slate-500">(all-time)</span>
        </h2>
        {contentList.length === 0 ? (
          <div className="storytime-empty-state p-6 text-sm text-slate-500">
            No content yet. Publish titles to see views, watch time, and engagement here.
          </div>
        ) : (
          <div className="storytime-section overflow-hidden">
            <div className="overflow-x-auto">
              <table className="storytime-table text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Views</th>
                    <th className="px-4 py-3 font-medium">Watch time</th>
                    <th className="px-4 py-3 font-medium">Comments</th>
                    <th className="px-4 py-3 font-medium">Ratings</th>
                    <th className="px-4 py-3 font-medium">Watchlist</th>
                    <th className="px-4 py-3 font-medium">Avg rating</th>
                  </tr>
                </thead>
                <tbody>
                  {contentList.map((c) => (
                    <tr key={c.id} className="border-b border-white/6 last:border-0">
                      <td className="px-4 py-3 text-white font-medium truncate max-w-[180px]">{c.title}</td>
                      <td className="px-4 py-3 text-slate-400">{c.type}</td>
                      <td className="px-4 py-3 text-white">{c.views.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-300">{Math.floor(c.watchTimeSeconds / 60)}m</td>
                      <td className="px-4 py-3 text-slate-300">{c.comments}</td>
                      <td className="px-4 py-3 text-slate-300">{c.ratings}</td>
                      <td className="px-4 py-3 text-slate-300">{c.watchlistAdds}</td>
                      <td className="px-4 py-3 text-slate-300">{c.avgRating != null ? c.avgRating.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {projects && projects.total > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-sky-400" /> Projects pipeline
          </h2>
          <div className="storytime-section flex flex-wrap gap-6 p-5">
            <div>
              <p className="text-xs text-slate-400 mb-1">Total projects</p>
              <p className="text-2xl font-bold text-white">{projects.total}</p>
            </div>
            {Object.keys(projects.byPhase).length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">By phase</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(projects.byPhase).map(([phase, count]) => (
                    <span key={phase} className="rounded-lg border border-white/8 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-200">
                      {phase}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(projects.byStatus).length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">By status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(projects.byStatus).map(([status, count]) => (
                    <span key={status} className="rounded-lg border border-white/8 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-200">
                      {status}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {competition && (competition.periodName || competition.rank != null) && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Competition
          </h2>
          <div className="storytime-section flex flex-wrap gap-6 p-5">
            {competition.periodName && <p className="text-slate-300">Period: {competition.periodName}</p>}
            {competition.endDate && <p className="text-slate-400 text-sm">Ends: {new Date(competition.endDate).toLocaleDateString()}</p>}
            {competition.rank != null && <p className="text-white font-medium">Your rank: #{competition.rank}</p>}
            <p className="text-slate-300">Votes received: {competition.voteCount}</p>
          </div>
        </section>
      )}

      <div className="storytime-section p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-400" /> How you earn
        </h2>
        <p className="text-slate-400 text-sm">
          60% of viewer subscription revenue is shared among creators by view share. Your share is based on your content&apos;s proportion of total platform views in the selected period.
        </p>
      </div>

      <div className="storytime-section p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-400" /> Banking
        </h2>
        {data.banking ? (
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.04] p-4">
            <div>
              <p className="text-white font-medium">{data.banking.bankName}</p>
              <p className="text-slate-400 text-sm">
                ••••{data.banking.accountNumberLast4} · {data.banking.accountType}
              </p>
              {data.banking.verified && <span className="text-xs text-emerald-400">Verified</span>}
            </div>
            <CreditCard className="w-8 h-8 text-slate-500" />
          </div>
        ) : (
          <form onSubmit={submitBank} className="max-w-md space-y-4">
            <input
              type="text"
              placeholder="Bank name"
              value={bankForm.bankName}
              onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
              required
              className="storytime-input px-4 py-2.5"
            />
            <input
              type="text"
              placeholder="Account number"
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))}
              required
              className="storytime-input px-4 py-2.5"
            />
            <select
              value={bankForm.accountType}
              onChange={(e) => setBankForm((f) => ({ ...f, accountType: e.target.value }))}
              className="storytime-select px-4 py-2.5"
            >
              <option value="CHEQUE">Cheque</option>
              <option value="SAVINGS">Savings</option>
            </select>
            <input
              type="text"
              placeholder="Branch code (SA)"
              value={bankForm.branchCode}
              onChange={(e) => setBankForm((f) => ({ ...f, branchCode: e.target.value }))}
              className="storytime-input px-4 py-2.5"
            />
            <button
              type="submit"
              disabled={submittingBank}
              className="rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
            >
              Save banking details
            </button>
          </form>
        )}
      </div>

      <div className="storytime-section p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5 text-violet-400" /> Payouts
        </h2>
        {data.payouts.length === 0 ? (
          <p className="text-slate-500 text-sm">No payouts yet. Payouts are processed by Story Time based on your earnings.</p>
        ) : (
          <ul className="space-y-2">
            {data.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <span className="text-white">R{p.amount.toFixed(2)}</span>
                <span className={`text-sm ${p.status === "COMPLETED" ? "text-emerald-400" : "text-slate-500"}`}>{p.status}</span>
                <span className="text-slate-500 text-sm">
                  {p.period}
                  {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString()}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
