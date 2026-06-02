"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, DollarSign, UtensilsCrossed } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { readCompanyApiJson } from "@/lib/casting-agency-client";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions, OpsSection } from "@/components/ecosystem/ops-shell";

export function CateringDashboardClient() {
  const [company, setCompany] = useState<{ companyName: string; tagline: string | null; logoUrl: string | null } | null>(null);
  const [metrics, setMetrics] = useState({ totalBookings: 0, pending: 0, confirmed: 0, revenue: 0 });
  const [recent, setRecent] = useState<{ id: string; status: string; eventDate: string | null; headCount: number | null; creator: { name: string | null } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/catering-company/overview")
      .then((r) => readCompanyApiJson<{
        company: typeof company;
        metrics: typeof metrics;
        recentBookings: typeof recent;
      }>(r))
      .then(({ data, error: err }) => {
        if (err) setError(err);
        setCompany(data?.company ?? null);
        if (data?.metrics) setMetrics(data.metrics);
        setRecent(data?.recentBookings ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!company) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Link href="/catering-company/profile" className="inline-flex px-5 py-2.5 rounded-lg bg-orange-500 text-white font-medium">
          Set up catering profile
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        {company.logoUrl && <img src={company.logoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />}
        <OpsPageHeader
          title={company.companyName}
          subtitle={company.tagline || "On-set catering — menus, gallery, event bookings, and settled revenue."}
        />
      </div>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <OpsMetricCard label="Bookings" value={metrics.totalBookings} icon={Calendar} accent="orange" />
        <OpsMetricCard label="Pending" value={metrics.pending} accent="amber" />
        <OpsMetricCard label="Confirmed" value={metrics.confirmed} accent="emerald" />
        <OpsMetricCard label="Revenue" value={formatZar(metrics.revenue)} icon={DollarSign} accent="emerald" />
      </div>

      <OpsQuickActions
        items={[
          { href: "/catering-company/profile", label: "Menu & gallery", description: "Food photos and service types" },
          { href: "/catering-company/deals", label: "Event pipeline", description: "All bookings in one view" },
          { href: "/catering-company/bookings", label: "Bookings inbox", description: "Confirm shoot catering" },
          { href: "/catering-company/wallet", label: "Wallet", description: "Payouts and balances" },
        ]}
      />

      <OpsSection title="Recent events">
        {recent.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-8 text-center text-slate-500">
            <UtensilsCrossed className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No bookings yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((b) => (
              <div key={b.id} className="flex justify-between rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
                <div>
                  <p className="text-white font-medium">{b.headCount ?? "?"} guests · {b.eventDate || "Date TBC"}</p>
                  <p className="text-xs text-slate-400">{b.creator?.name || "Creator"}</p>
                </div>
                <span className="text-xs text-slate-300">{b.status}</span>
              </div>
            ))}
          </div>
        )}
      </OpsSection>
    </div>
  );
}
