"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Printer, RefreshCw, Save } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { formatZar } from "@/lib/format-currency-zar";

type Report = {
  id: string;
  title: string;
  lastRunAt?: string | null;
  createdAt: string;
  definition?: Record<string, unknown>;
};

type Generated = {
  narrative?: string;
  kpis?: Array<{
    id: string;
    label: string;
    value: number | string;
    unit?: string;
    deltaPct?: number | null;
  }>;
  alerts?: Array<{ severity: string; title: string; description: string }>;
  meta?: { period?: { label?: string }; freshnessLabel?: string };
  office?: string;
  question?: string;
};

function formatKpi(value: number | string, unit?: string) {
  if (typeof value === "number" && unit === "ZAR") return formatZar(value);
  if (typeof value === "number" && unit === "%") return `${value.toFixed(1)}%`;
  if (typeof value === "number") return value.toLocaleString("en-ZA");
  return String(value);
}

export function ExecutiveReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<Generated | null>(null);
  const [title, setTitle] = useState("Leadership briefing");
  const [intro, setIntro] = useState("");
  const [closing, setClosing] = useState("");

  async function loadReports() {
    setLoading(true);
    try {
      const r = await fetch("/api/executive/reports");
      const data = (await r.json()) as { reports?: Report[]; error?: string };
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

  async function generate() {
    setGenerating(true);
    try {
      const r = await fetch("/api/executive/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", title }),
      });
      const data = (await r.json()) as Generated & { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to generate report");
      setDoc(data);
      if (!intro) {
        setIntro(
          data.question
            ? `This briefing answers: ${data.question}`
            : "Executive snapshot drawn from the live Story Time data layer.",
        );
      }
      if (!closing) {
        setClosing("Prepared for internal leadership use. Figures refresh with the executive data layer.");
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  async function saveDefinition() {
    setSaving(true);
    try {
      const r = await fetch("/api/executive/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          title: title.trim() || "Leadership briefing",
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to save");
      await loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const pages = useMemo(() => {
    if (!doc) return [];
    const kpis = doc.kpis ?? [];
    const alerts = doc.alerts ?? [];
    return [
      { id: "cover", kind: "cover" as const },
      { id: "kpis", kind: "kpis" as const, rows: kpis },
      ...(alerts.length ? [{ id: "alerts", kind: "alerts" as const, rows: alerts }] : []),
    ];
  }, [doc]);

  if (loading) return <StoryTimeLoadingCenter />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/80">
            Executive suite
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-white">
            Reports
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Compose leadership briefings as editable document pages — then print or save the definition.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm text-orange-100 transition hover:bg-orange-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Building…" : doc ? "Refresh data" : "Generate briefing"}
          </button>
          <button
            type="button"
            onClick={() => void saveDefinition()}
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-200 transition hover:border-white/20 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!doc}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-orange-50 disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 print:hidden">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3 print:hidden">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Saved definitions
          </p>
          {reports.length === 0 ? (
            <p className="text-sm text-slate-500">No saved reports yet.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(report.title);
                      void generate();
                    }}
                    className="w-full rounded-xl border border-white/8 bg-slate-900/50 px-3 py-3 text-left transition hover:border-orange-500/30"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <FileText className="h-3.5 w-3.5 text-orange-300" />
                      <span className="truncate">{report.title}</span>
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {report.lastRunAt
                        ? `Last run ${new Date(report.lastRunAt).toLocaleString("en-ZA")}`
                        : `Created ${new Date(report.createdAt).toLocaleDateString("en-ZA")}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="space-y-8">
          {!doc ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-16 text-center">
              <p className="font-display text-xl text-white">No briefing open</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                Generate a live snapshot to open editable document pages with KPIs, narrative, and alerts.
              </p>
            </div>
          ) : (
            pages.map((page, pageIndex) => (
              <article
                key={page.id}
                className="executive-report-page relative mx-auto max-w-[820px] overflow-hidden rounded-[2px] bg-[#f7f4ee] text-slate-900 shadow-[0_25px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="pointer-events-none absolute inset-x-8 top-0 h-1.5 bg-gradient-to-r from-orange-600 via-orange-400 to-amber-500" />
                <div className="relative px-10 py-12 sm:px-14 sm:py-14">
                  <div className="mb-8 flex items-start justify-between gap-4 border-b border-slate-300/70 pb-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-700">
                        Story Time · {doc.office ?? "Executive"} Office
                      </p>
                      {page.kind === "cover" ? (
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="mt-3 w-full border-0 bg-transparent font-display text-3xl font-semibold tracking-tight text-slate-900 outline-none focus:ring-0"
                        />
                      ) : (
                        <h2 className="mt-3 font-display text-2xl font-semibold text-slate-900">
                          {page.kind === "kpis" ? "Key performance indicators" : "Attention items"}
                        </h2>
                      )}
                    </div>
                    <div className="text-right text-[11px] leading-relaxed text-slate-500">
                      <p>Page {pageIndex + 1}</p>
                      <p>{doc.meta?.period?.label ?? "Current period"}</p>
                      <p>{doc.meta?.freshnessLabel ?? "Live data"}</p>
                    </div>
                  </div>

                  {page.kind === "cover" ? (
                    <div className="space-y-6">
                      <textarea
                        value={intro}
                        onChange={(e) => setIntro(e.target.value)}
                        rows={4}
                        className="w-full resize-none border-0 bg-transparent text-[15px] leading-7 text-slate-700 outline-none"
                      />
                      <div className="rounded-sm border border-slate-300/80 bg-white/60 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Source narrative
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-6 text-slate-700">
                          {doc.narrative}
                        </pre>
                      </div>
                      <textarea
                        value={closing}
                        onChange={(e) => setClosing(e.target.value)}
                        rows={3}
                        className="w-full resize-none border-0 bg-transparent text-[14px] leading-7 text-slate-600 outline-none"
                      />
                    </div>
                  ) : null}

                  {page.kind === "kpis" ? (
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-300 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                          <th className="py-2 font-semibold">Metric</th>
                          <th className="py-2 font-semibold">Value</th>
                          <th className="py-2 font-semibold">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page.rows.map((kpi) => (
                          <tr key={kpi.id} className="border-b border-slate-200/80">
                            <td className="py-3 pr-3 text-slate-800">{kpi.label}</td>
                            <td className="py-3 pr-3 font-medium tabular-nums text-slate-900">
                              {formatKpi(kpi.value, kpi.unit)}
                            </td>
                            <td className="py-3 tabular-nums text-slate-600">
                              {kpi.deltaPct == null ? "—" : `${kpi.deltaPct > 0 ? "+" : ""}${kpi.deltaPct.toFixed(1)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}

                  {page.kind === "alerts" ? (
                    <ul className="space-y-4">
                      {page.rows.map((alert, i) => (
                        <li key={`${alert.title}-${i}`} className="border-l-2 border-orange-600 pl-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-800">
                            {alert.severity}
                          </p>
                          <p className="mt-1 font-medium text-slate-900">{alert.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">{alert.description}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-10 flex items-center justify-between border-t border-slate-300/70 pt-3 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <span>Confidential · Story Time leadership</span>
                    <span>{new Date().toLocaleDateString("en-ZA")}</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .executive-report-page,
          .executive-report-page * { visibility: visible !important; }
          .executive-report-page {
            position: relative !important;
            margin: 0 auto 24px !important;
            box-shadow: none !important;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
}
