"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Clock, DollarSign, Wrench, Camera } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { readCompanyApiJson } from "@/lib/casting-agency-client";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions, OpsSection } from "@/components/ecosystem/ops-shell";
import { StakeholderEcosystemHome } from "@/components/ecosystem/stakeholder-ecosystem-home";

export function EquipmentDashboardClient() {
  const [metrics, setMetrics] = useState({ listings: 0, totalRequests: 0, pending: 0, approved: 0, revenue: 0 });
  const [recent, setRecent] = useState<
    { id: string; status: string; equipment: { companyName: string; category: string; imageUrl: string | null }; requester: { name: string | null } }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/equipment-company/overview")
      .then((r) => readCompanyApiJson<{ metrics: typeof metrics; recentRequests: typeof recent }>(r))
      .then(({ data, error: err }) => {
        if (err) setError(err);
        if (data?.metrics) setMetrics(data.metrics);
        setRecent(data?.recentRequests ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10 md:px-12">
      <OpsPageHeader
        title="Equipment operations"
        subtitle="Fleet catalog with kit photos, rental requests, and settled marketplace revenue — built for camera, grip, and production gear houses."
      />
      {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{error}</div>}

      <StakeholderEcosystemHome portalPrefix="/equipment-company" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <OpsMetricCard label="Fleet items" value={metrics.listings} icon={Package} accent="cyan" />
        <OpsMetricCard label="Requests" value={metrics.totalRequests} accent="orange" />
        <OpsMetricCard label="Pending" value={metrics.pending} icon={Clock} accent="amber" />
        <OpsMetricCard label="Approved" value={metrics.approved} accent="emerald" />
        <OpsMetricCard label="Settled revenue" value={formatZar(metrics.revenue, { maximumFractionDigits: 0 })} icon={DollarSign} accent="emerald" />
      </div>

      <OpsQuickActions
        items={[
          { href: "/equipment-company/listings", label: "Fleet & kit", description: "Upload photos, specs, and day rates" },
          { href: "/equipment-company/deals", label: "Rental pipeline", description: "All requests in one timeline" },
          { href: "/equipment-company/requests", label: "Request inbox", description: "Approve or decline rentals" },
          { href: "/equipment-company/wallet", label: "Wallet", description: "Payouts and balances" },
        ]}
      />

      <OpsSection title="Recent rental requests">
        {recent.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500">
            <Camera className="mx-auto mb-3 h-10 w-10 opacity-40" />
            No requests yet. List gear with photos so creators can preview your kit.
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((r) => (
              <Link key={r.id} href="/equipment-company/requests" className="flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-cyan-500/30">
                {r.equipment.imageUrl ? (
                  <img src={r.equipment.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-700/50">
                    <Wrench className="h-5 w-5 text-slate-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{r.equipment.companyName}</p>
                  <p className="text-sm text-slate-400">
                    {r.equipment.category} · {r.requester?.name || "Creator"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-200">{r.status}</span>
              </Link>
            ))}
          </div>
        )}
      </OpsSection>
    </main>
  );
}
