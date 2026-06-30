"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { OpsPageHeader } from "@/components/ecosystem/ops-shell";
import { useStakeholderSync } from "@/hooks/use-stakeholder-sync";
import type { StakeholderWorkspaceOverview } from "@/lib/stakeholder-ecosystem/types";

function useWorkspace() {
  return useQuery({
    queryKey: ["stakeholder-workspace"],
    queryFn: () =>
      fetch("/api/stakeholder/workspace").then((r) => {
        if (!r.ok) throw new Error("Failed to load workspace");
        return r.json() as Promise<{ workspace: StakeholderWorkspaceOverview }>;
      }),
  });
}

export function StakeholderTasksPage({ portalPrefix }: { portalPrefix: string }) {
  useStakeholderSync();
  const { data, isLoading, error } = useWorkspace();
  const ws = data?.workspace;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <OpsPageHeader title="Action centre" subtitle="Prioritized tasks from bookings, inquiries, contracts, and production workflows." />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">Could not load tasks.</p>}
      <div className="space-y-2">
        {(ws?.tasks ?? []).map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm hover:border-orange-500/30"
          >
            <div>
              <p className="font-medium text-white">{t.title}</p>
              {t.subtitle && <p className="text-xs text-slate-500">{t.subtitle}</p>}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                t.priority === "HIGH" ? "bg-red-500/20 text-red-300" : "bg-slate-700/50 text-slate-400"
              }`}
            >
              {t.priority}
            </span>
          </Link>
        ))}
        {ws && ws.tasks.length === 0 && (
          <p className="rounded-xl border border-slate-800 p-8 text-center text-sm text-slate-500">All caught up.</p>
        )}
      </div>
      {(ws?.approvals ?? []).length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-white">Approvals</h2>
          {ws!.approvals.map((a) => (
            <Link key={a.id} href={a.href} className="block rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-300 hover:border-orange-500/30">
              {a.title} · <span className="text-slate-500">{a.status}</span>
            </Link>
          ))}
        </div>
      )}
      <Link href={`${portalPrefix}/dashboard`} className="text-xs text-orange-400 hover:text-orange-300">
        ← Back to dashboard
      </Link>
    </div>
  );
}

export function StakeholderCalendarPage({ portalPrefix }: { portalPrefix: string }) {
  useStakeholderSync();
  const { data, isLoading } = useWorkspace();
  const ws = data?.workspace;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <OpsPageHeader title="Calendar" subtitle="Bookings, shoot days, auditions, and deal milestones — synced with the production ecosystem." />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="space-y-2">
        {(ws?.calendar ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-white">{c.title}</p>
              <p className="text-xs text-slate-500">{c.kind}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>{c.date.slice(0, 10)}</p>
              {c.endDate && <p>→ {c.endDate.slice(0, 10)}</p>}
            </div>
          </div>
        ))}
        {ws && ws.calendar.length === 0 && (
          <p className="rounded-xl border border-slate-800 p-8 text-center text-sm text-slate-500">No upcoming events.</p>
        )}
      </div>
      <Link href={`${portalPrefix}/dashboard`} className="text-xs text-orange-400 hover:text-orange-300">
        ← Back to dashboard
      </Link>
    </div>
  );
}

export function StakeholderActivityPage({ portalPrefix }: { portalPrefix: string }) {
  useStakeholderSync();
  const { data, isLoading } = useWorkspace();
  const ws = data?.workspace;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <OpsPageHeader
        title="Activity feed"
        subtitle="Notifications and platform events — changes from productions you work with appear here automatically."
      />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="space-y-2">
        {(ws?.activity ?? []).map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm">
            <p className="font-medium text-white">{a.title}</p>
            {a.body && <p className="mt-1 text-xs text-slate-400">{a.body}</p>}
            <p className="mt-2 text-[10px] text-slate-600">{new Date(a.at).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <Link href={`${portalPrefix}/dashboard`} className="text-xs text-orange-400 hover:text-orange-300">
        ← Back to dashboard
      </Link>
    </div>
  );
}
