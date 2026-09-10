"use client";

import Link from "next/link";
import { AlertTriangle, Bell, Info, ShieldAlert } from "lucide-react";
import type { ExecutiveAlert } from "@/lib/executive/types";

type AlertsPanelProps = {
  alerts: ExecutiveAlert[];
  className?: string;
};

const severityStyles: Record<
  ExecutiveAlert["severity"],
  { border: string; bg: string; text: string; icon: typeof AlertTriangle }
> = {
  CRITICAL: {
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-300",
    icon: ShieldAlert,
  },
  HIGH: {
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
    text: "text-orange-300",
    icon: AlertTriangle,
  },
  MEDIUM: {
    border: "border-amber-500/35",
    bg: "bg-amber-500/8",
    text: "text-amber-300",
    icon: Bell,
  },
  LOW: {
    border: "border-slate-500/30",
    bg: "bg-slate-800/40",
    text: "text-slate-300",
    icon: Info,
  },
};

export function AlertsPanel({ alerts, className = "" }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div
        className={`rounded-xl border border-white/8 bg-slate-900/40 p-6 text-center text-sm text-slate-500 ${className}`.trim()}
      >
        No active alerts for this office.
      </div>
    );
  }

  return (
    <ul className={`space-y-3 ${className}`.trim()}>
      {alerts.map((alert) => {
        const style = severityStyles[alert.severity];
        const Icon = style.icon;
        const content = (
          <div
            className={`rounded-xl border ${style.border} ${style.bg} p-4 transition [@media(hover:hover)]:border-white/20`}
          >
            <div className="flex gap-3">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{alert.title}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.text}`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{alert.description}</p>
                {(alert.currentValue || alert.expectedValue) && (
                  <p className="mt-2 text-xs text-slate-500">
                    {alert.metric ? `${alert.metric}: ` : ""}
                    {alert.currentValue ?? "—"}
                    {alert.expectedValue ? ` · expected ${alert.expectedValue}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

        return (
          <li key={alert.id}>
            {alert.href ? (
              <Link href={alert.href} className="block">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
