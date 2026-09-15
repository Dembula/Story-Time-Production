"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ChevronDown, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type PathRow = { path: string | null; label?: string; count: number };
type PersonRow = {
  key: string;
  who: string;
  roleLabel: string;
  where: string;
  when: string;
};
type CrashRow = {
  id: string;
  name: string;
  nameLabel?: string;
  path: string | null;
  where?: string;
  createdAt: string;
  message: string | null;
  title?: string;
  summary?: string;
  severity?: "info" | "warning" | "critical";
  who?: string;
  roleLabel?: string;
  device?: string;
  mobile: boolean | null;
};

type LiveSummary = {
  activeUsersApprox?: number;
  pageViews7d?: number;
  crashes7d?: number;
  clientErrors7d?: number;
  topPaths1h?: PathRow[];
  recentPeople?: PersonRow[];
  recentCrashes?: CrashRow[];
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityStyles(severity: CrashRow["severity"]) {
  if (severity === "critical") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  if (severity === "info") return "border-sky-500/25 bg-sky-500/10 text-sky-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function ErrorAccordionItem({ row }: { row: CrashRow }) {
  const [open, setOpen] = useState(false);
  const title = row.title || row.nameLabel || "Page error";
  const summary =
    row.summary ||
    row.message ||
    "A browser error was recorded without further detail.";

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <span
          className={cn(
            "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            severityStyles(row.severity),
          )}
        >
          {row.severity === "critical" ? "Urgent" : row.severity === "info" ? "Notice" : "Warning"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">{title}</span>
          <span className="mt-0.5 block text-xs text-slate-400">
            {row.who || "Guest visitor"}
            {row.roleLabel ? ` · ${row.roleLabel}` : ""}
            {" · "}
            {row.where || "Unknown page"}
            {" · "}
            {relativeTime(row.createdAt)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-slate-500 transition",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-white/8 bg-white/[0.02] px-3.5 py-3 text-xs leading-relaxed text-slate-400">
          <p className="text-slate-300">{summary}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <p>
              <span className="text-slate-500">Where: </span>
              {row.where || "Unknown page"}
            </p>
            <p>
              <span className="text-slate-500">Who: </span>
              {row.who || "Guest visitor"}
              {row.roleLabel ? ` (${row.roleLabel})` : ""}
            </p>
            <p>
              <span className="text-slate-500">Device: </span>
              {row.device || (row.mobile ? "Mobile" : "Desktop / unknown")}
            </p>
            <p>
              <span className="text-slate-500">When: </span>
              {new Date(row.createdAt).toLocaleString()}
            </p>
          </div>
          {row.message ? (
            <details className="rounded-lg border border-white/8 bg-black/30 px-2.5 py-2">
              <summary className="cursor-pointer text-[11px] font-medium text-slate-500">
                Technical detail
              </summary>
              <p className="mt-1.5 break-words font-mono text-[11px] text-slate-500">{row.message}</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AdminLiveOpsPanel({
  live,
}: {
  live?: LiveSummary | null;
}) {
  const crashes = live?.recentCrashes ?? [];
  const people = live?.recentPeople ?? [];
  const paths = live?.topPaths1h ?? [];

  const errorGroups = useMemo(() => {
    const map = new Map<string, CrashRow[]>();
    for (const row of crashes) {
      const key = row.title || row.nameLabel || row.name;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [crashes]);

  return (
    <Card className="storytime-section mb-10 border-cyan-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-white">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            Live activity &amp; stability
          </span>
          <Link
            href="/admin/activity"
            className="text-xs font-medium text-orange-300 hover:text-orange-200"
          >
            Full activity log →
          </Link>
        </CardTitle>
        <p className="text-sm text-slate-400">
          A clear view of who is on the platform, what they are opening, and what went wrong — in plain English.
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: "Active now (~15m)",
              value: live?.activeUsersApprox ?? 0,
              tone: "text-white",
            },
            {
              label: "Page views (7d)",
              value: live?.pageViews7d ?? 0,
              tone: "text-white",
            },
            {
              label: "Problems (7d)",
              value: live?.crashes7d ?? 0,
              tone: "text-amber-300",
            },
            {
              label: "Page errors (7d)",
              value: live?.clientErrors7d ?? 0,
              tone: "text-white",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-white/8 bg-gradient-to-b from-white/[0.05] to-transparent p-3"
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", kpi.tone)}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 bg-black/30 p-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
              <Activity className="hidden h-3.5 w-3.5 sm:block" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-1.5 text-xs sm:text-sm">
              <Users className="hidden h-3.5 w-3.5 sm:block" />
              People
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-1.5 text-xs sm:text-sm">
              <AlertTriangle className="hidden h-3.5 w-3.5 sm:block" />
              Errors
              {crashes.length > 0 ? (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  {crashes.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-cyan-300" />
                <p className="text-sm font-medium text-white">Most visited right now</p>
              </div>
              {paths.length === 0 ? (
                <p className="text-sm text-slate-500">No page activity in the last hour yet.</p>
              ) : (
                <ul className="space-y-2">
                  {paths.map((row) => (
                    <li
                      key={`${row.path}-${row.count}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-slate-200">
                        {row.label || row.path || "Homepage"}
                      </span>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs tabular-nums text-slate-400">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Open the <span className="text-slate-300">People</span> tab to see who is browsing, or{" "}
              <span className="text-slate-300">Errors</span> for plain-English problem reports.
            </p>
          </TabsContent>

          <TabsContent value="people" className="mt-0">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="mb-3 text-sm font-medium text-white">Who has been active recently</p>
              {people.length === 0 ? (
                <p className="text-sm text-slate-500">No signed-in or guest activity in the last 15 minutes.</p>
              ) : (
                <ul className="divide-y divide-white/6">
                  {people.map((person) => (
                    <li key={person.key} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{person.who}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {person.roleLabel} · {person.where}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {relativeTime(person.when)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="errors" className="mt-0 space-y-3">
            {crashes.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-6 text-center">
                <p className="text-sm font-medium text-emerald-200">No crash or error signals in the last 7 days</p>
                <p className="mt-1 text-xs text-emerald-200/70">
                  When something breaks for a visitor, it will appear here in plain English.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Tap a row to expand who was affected, where they were, and what it means.
                </p>
                {errorGroups.map(([groupTitle, rows]) => (
                  <details
                    key={groupTitle}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] open:bg-white/[0.03]"
                    open={errorGroups.length === 1}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-white">{groupTitle}</span>
                        <span className="text-xs text-slate-500">
                          {rows.length} report{rows.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t border-white/8 px-3 py-3">
                      {rows.map((row) => (
                        <ErrorAccordionItem key={row.id} row={row} />
                      ))}
                    </div>
                  </details>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
