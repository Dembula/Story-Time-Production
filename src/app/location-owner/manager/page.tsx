"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { OpsPageHeader } from "@/components/ecosystem/ops-shell";

export default function LocationManagerPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stakeholder-workspace", "manager"],
    queryFn: () => fetch("/api/stakeholder/workspace?locationMode=manager").then((r) => r.json()),
  });

  const ws = data?.workspace;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <OpsPageHeader
        title="Location manager"
        subtitle="On-site manager view — bookings and calendar for properties assigned to you (distinct from portfolio owner)."
      />
      <Link href="/location-owner/dashboard" className="text-xs text-orange-400 hover:text-orange-300">
        ← Switch to owner dashboard
      </Link>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {ws && (
        <>
          <p className="text-sm text-slate-400">{ws.summary}</p>
          <p className="text-xs text-slate-500">Managing {ws.locationContext?.listingCount ?? 0} assigned listing(s)</p>
          <div className="space-y-2">
            {(ws.tasks ?? []).map((t: { id: string; title: string; subtitle?: string; href: string }) => (
              <Link key={t.id} href={t.href} className="block rounded-xl border border-slate-800 px-4 py-3 text-sm hover:border-orange-500/30">
                <span className="text-white">{t.title}</span>
                {t.subtitle && <span className="mt-0.5 block text-xs text-slate-500">{t.subtitle}</span>}
              </Link>
            ))}
            {ws.tasks.length === 0 && <p className="text-sm text-slate-500">No pending manager actions.</p>}
          </div>
        </>
      )}
    </div>
  );
}
