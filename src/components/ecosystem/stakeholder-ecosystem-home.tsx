"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, Bell, Calendar, CheckSquare, Sparkles } from "lucide-react";
import { OpsSection } from "@/components/ecosystem/ops-shell";
import { useStakeholderSync } from "@/hooks/use-stakeholder-sync";
import type { StakeholderWorkspaceOverview } from "@/lib/stakeholder-ecosystem/types";

type Props = {
  portalPrefix: string;
  /** When true, only show compact strip (for embedding above role metrics). */
  compact?: boolean;
};

export function StakeholderEcosystemHome({ portalPrefix, compact = false }: Props) {
  useStakeholderSync();
  const { data, isLoading } = useQuery({
    queryKey: ["stakeholder-workspace"],
    queryFn: () =>
      fetch("/api/stakeholder/workspace").then((r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{ workspace: StakeholderWorkspaceOverview }>;
      }),
    staleTime: 60_000,
  });

  const ws = data?.workspace;
  if (isLoading || !ws) return null;

  if (compact) {
    return (
      <div className="space-y-3">
        {ws.alerts.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            {ws.alerts.map((a) => (
              <p key={a} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {a}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ws.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {ws.alerts.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckSquare className="h-4 w-4 text-orange-400" />
              Action centre
            </h3>
            <Link href={`${portalPrefix}/tasks`} className="text-[11px] text-orange-400 hover:text-orange-300">
              View all
            </Link>
          </div>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {ws.tasks.length === 0 ? (
              <li className="text-slate-500">No pending actions — you&apos;re caught up.</li>
            ) : (
              ws.tasks.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="block rounded-lg border border-slate-800/80 px-2 py-2 hover:border-orange-500/30">
                    <span className="font-medium text-slate-200">{t.title}</span>
                    {t.subtitle && <span className="mt-0.5 block text-slate-500">{t.subtitle}</span>}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Calendar className="h-4 w-4 text-cyan-400" />
              Upcoming
            </h3>
            <Link href={`${portalPrefix}/calendar`} className="text-[11px] text-orange-400 hover:text-orange-300">
              Calendar
            </Link>
          </div>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-slate-400">
            {ws.calendar.length === 0 ? (
              <li>No upcoming events on your calendar.</li>
            ) : (
              ws.calendar.slice(0, 5).map((c) => (
                <li key={c.id} className="flex justify-between gap-2 border-b border-slate-800/50 pb-2">
                  <span className="text-slate-300">{c.title}</span>
                  <span className="shrink-0 text-slate-500">{c.date.slice(0, 10)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Bell className="h-4 w-4 text-violet-400" />
              Activity
            </h3>
            <Link href={`${portalPrefix}/activity`} className="text-[11px] text-orange-400 hover:text-orange-300">
              Feed
            </Link>
          </div>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {ws.activity.slice(0, 5).map((a) => (
              <li key={a.id} className="text-slate-400">
                <span className="text-slate-300">{a.title}</span>
                <span className="mt-0.5 block text-[10px] text-slate-600">{new Date(a.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {ws.unreadNotifications > 0 && (
            <p className="mt-2 text-[11px] text-orange-300">{ws.unreadNotifications} unread notification(s)</p>
          )}
        </div>
      </div>

      {ws.connectedProductions > 0 && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-orange-400/80" />
          Connected to {ws.connectedProductions} active production relationship(s) on Story Time.
        </p>
      )}

      {typeof ws.moduleInsights?.inventory === "object" && ws.moduleInsights.inventory !== null && (
        <p className="text-xs text-slate-500">
          RFID inventory: {(ws.moduleInsights.inventory as { totalTags?: number }).totalTags ?? 0} tags tracked ·{" "}
          <Link href={`${portalPrefix}/inventory`} className="text-orange-400 hover:text-orange-300">
            Open inventory
          </Link>
        </p>
      )}
      {typeof ws.moduleInsights?.mealForecast === "object" && ws.moduleInsights.mealForecast !== null && (
        <p className="text-xs text-slate-500">
          Meal forecasts: {(ws.moduleInsights.mealForecast as { upcomingCount?: number }).upcomingCount ?? 0} upcoming ·{" "}
          <Link href={`${portalPrefix}/forecast`} className="text-orange-400 hover:text-orange-300">
            Open forecast
          </Link>
        </p>
      )}
      {ws.locationContext?.mode === "manager" && (
        <p className="text-xs text-amber-300/80">Manager mode — {ws.locationContext.listingCount} assigned listing(s)</p>
      )}
    </div>
  );
}

export function StakeholderEcosystemSection({ portalPrefix, title, children }: Props & { title?: string; children?: ReactNode }) {
  return (
    <div className="space-y-8">
      <StakeholderEcosystemHome portalPrefix={portalPrefix} compact />
      {children ? <OpsSection title={title ?? "Operations"}>{children}</OpsSection> : null}
    </div>
  );
}
