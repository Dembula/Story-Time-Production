"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { StoryTimeMark } from "@/components/brand/story-time-mark";
import { LogOutButton } from "@/components/auth/log-out-button";

type ExecutiveShellProps = {
  office: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  homePath: string;
  children: React.ReactNode;
};

const navItems = [
  { label: "Home", pathKey: "home" as const },
  { label: "Calendar", href: "/executive/calendar" },
  { label: "Comms", href: "/executive/comms" },
  { label: "Reports", href: "/executive/reports" },
];

function formatLiveDatetime(date: Date): string {
  return date.toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function ExecutiveShell({
  office,
  email,
  name,
  isAdmin,
  homePath,
  children,
}: ExecutiveShellProps) {
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date());
  const [alertsCount, setAlertsCount] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/executive/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.alerts) {
          setAlertsCount(Array.isArray(data.alerts) ? data.alerts.length : 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function isNavActive(item: (typeof navItems)[number]): boolean {
    if (item.pathKey === "home") {
      return pathname === homePath || pathname.startsWith(`${homePath}/`);
    }
    return item.href ? pathname === item.href || pathname.startsWith(`${item.href}/`) : false;
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(249,115,22,0.02)_100%)]" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

      <header className="relative z-20 border-b border-white/8 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={homePath} className="shrink-0">
              <StoryTimeMark size={32} priority />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-orange-300">
                  {office} Office
                </span>
                {alertsCount > 0 ? (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-300">
                    {alertsCount} alert{alertsCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">
                {name ? `${name} · ` : ""}
                {email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="hidden text-xs tabular-nums text-slate-500 lg:block" aria-live="polite">
              {formatLiveDatetime(now)}
            </p>
            <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-white/8 bg-slate-900/50 p-1">
              {navItems.map((item) => {
                const href = item.pathKey === "home" ? homePath : item.href!;
                const active = isNavActive(item);
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={`rounded-md px-3 py-1.5 text-sm transition ${
                      active
                        ? "bg-orange-500/15 font-medium text-orange-200"
                        : "text-slate-400 [@media(hover:hover)]:bg-white/5 [@media(hover:hover)]:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition [@media(hover:hover)]:border-orange-500/30 [@media(hover:hover)]:text-orange-200"
              >
                Open ops console
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
            <LogOutButton className="min-w-0 px-3 py-1.5 text-sm" showIcon={false} />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
