"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, ArrowLeft } from "lucide-react";

type Summary = {
  id: string;
  title: string;
  summary: string;
  keyPoints: unknown;
  decisions: unknown;
  actionItems: unknown;
  recordingUrl?: string | null;
  durationSec: number | null;
  createdAt: string;
  meeting: { id: string; code: string };
};

export function MeetSummariesClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["meet-summaries"],
    queryFn: async () => {
      const res = await fetch("/api/meet/summaries", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return (await res.json()) as { summaries: Summary[] };
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-12">
      <header className="storytime-plan-card space-y-3 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
              Story Time Meet
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-white">Summaries</h1>
            <p className="mt-2 max-w-lg text-sm text-slate-400">
              VA notes from your meetings — download a clean PDF for producers, clients, or your
              archive.
            </p>
          </div>
          <Link
            href="/creator/meet"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Meet
          </Link>
        </div>
      </header>

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (data?.summaries ?? []).length === 0 ? (
        <div className="storytime-plan-card flex flex-col items-center gap-3 p-10 text-center">
          <FileText className="h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">
            No summaries yet. End a Meet and the VA will generate one automatically.
          </p>
          <Link href="/creator/meet" className="text-xs text-orange-300 hover:underline">
            Start a Meet
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {data!.summaries.map((s) => {
            const keyPoints = Array.isArray(s.keyPoints) ? s.keyPoints.map(String) : [];
            const decisions = Array.isArray(s.decisions) ? s.decisions.map(String) : [];
            const actions = Array.isArray(s.actionItems) ? s.actionItems.map(String) : [];
            return (
              <li key={s.id} className="storytime-plan-card space-y-5 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/6 pb-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/80">
                      VA report
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{s.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleString()}
                      {s.durationSec != null
                        ? ` · ${Math.floor(s.durationSec / 60)}m ${s.durationSec % 60}s`
                        : ""}
                      {" · "}
                      <span className="font-mono">{s.meeting.code}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.recordingUrl ? (
                      <a
                        href={s.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                      >
                        Watch recording
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          try {
                            const res = await fetch(`/api/meet/summaries/${s.id}/pdf`, {
                              credentials: "include",
                            });
                            if (!res.ok) {
                              const json = await res.json().catch(() => ({}));
                              throw new Error(json.error || "PDF download failed");
                            }
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `story-time-meet-${s.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "summary"}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "PDF download failed");
                          }
                        })();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500/15 px-3 py-2 text-xs font-medium text-orange-100 ring-1 ring-orange-400/25 hover:bg-orange-500/25"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Summary
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                    {s.summary}
                  </p>
                </div>
                {keyPoints.length ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Key points
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-400">
                      {keyPoints.slice(0, 10).map((k) => (
                        <li key={k} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400/80" />
                          <span>{k}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {decisions.length ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Decisions
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-300">
                      {decisions.slice(0, 10).map((k) => (
                        <li
                          key={k}
                          className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2"
                        >
                          {k}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {actions.length ? (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Action items
                    </p>
                    <ul className="space-y-1.5 text-sm text-slate-400">
                      {actions.slice(0, 10).map((k) => (
                        <li
                          key={k}
                          className="rounded-lg border border-white/8 bg-black/25 px-3 py-2"
                        >
                          {k}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
