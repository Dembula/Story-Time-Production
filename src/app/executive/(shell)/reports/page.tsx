"use client";

import { useEffect, useState } from "react";
import { FileBarChart, Play, Plus } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

type Report = {
  id: string;
  title: string;
  office: string;
  lastRunAt?: string | null;
  createdAt: string;
  definition?: Record<string, unknown>;
};

type ReportsResponse = {
  reports?: Report[];
  result?: unknown;
  error?: string;
};

export default function ExecutiveReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [form, setForm] = useState({ title: "" });

  async function loadReports() {
    setLoading(true);
    try {
      const r = await fetch("/api/executive/reports");
      const data = (await r.json()) as ReportsResponse;
      if (!r.ok) throw new Error(data.error ?? "Failed to load reports");
      setReports(data.reports ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/executive/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          title: form.title.trim(),
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to create report");
      setForm({ title: "" });
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create report");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRun(title?: string) {
    setRunningId(title ?? "generate");
    try {
      const r = await fetch("/api/executive/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", title: title ?? "Executive snapshot" }),
      });
      const data = (await r.json()) as ReportsResponse & { narrative?: string; kpis?: unknown[] };
      if (!r.ok) throw new Error(data.error ?? "Failed to run report");
      setLastResult(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run report");
    } finally {
      setRunningId(null);
    }
  }

  if (loading) return <StoryTimeLoadingCenter />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white md:text-3xl">
          <FileBarChart className="h-6 w-6 text-orange-400" />
          Executive reports
        </h1>
        <p className="mt-1 text-sm text-slate-400">Saved definitions and scheduled leadership briefings.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="rounded-xl border border-white/8 bg-slate-900/40 p-5 space-y-4"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4 text-orange-400" />
          New report
        </h2>
        <div className="flex flex-wrap gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-xs text-slate-500">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ title: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
              placeholder="Weekly KPI digest"
              required
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save report"}
            </button>
          </div>
        </div>
      </form>

      <section className="rounded-xl border border-white/8 bg-slate-900/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Saved reports</h2>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={runningId !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-sm text-orange-200 disabled:opacity-50 [@media(hover:hover)]:bg-orange-500/20"
          >
            <Play className="h-3.5 w-3.5" />
            {runningId ? "Generating…" : "Generate snapshot"}
          </button>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-500">No reports defined yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-white">{report.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created {new Date(report.createdAt).toLocaleDateString("en-ZA")}
                    {report.lastRunAt
                      ? ` · last run ${new Date(report.lastRunAt).toLocaleString("en-ZA")}`
                      : " · never run"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRun(report.title)}
                  disabled={runningId !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50 [@media(hover:hover)]:border-orange-500/30 [@media(hover:hover)]:text-orange-200"
                >
                  <Play className="h-3.5 w-3.5" />
                  Generate
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lastResult ? (
        <section className="rounded-xl border border-white/8 bg-slate-950/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Last run output</h2>
          <pre className="max-h-80 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-300">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
