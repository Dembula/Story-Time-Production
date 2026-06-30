"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, LineChart, Shield, Sparkles } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions } from "@/components/ecosystem/ops-shell";
import { StakeholderEcosystemHome } from "@/components/ecosystem/stakeholder-ecosystem-home";

export default function FundersHomePage() {
  const { data } = useQuery({
    queryKey: ["funder-portfolio-summary"],
    queryFn: async () => fetch("/api/funders/portfolio").then((r) => r.json()),
  });
  const { data: ecosystem } = useQuery({
    queryKey: ["ecosystem-summary-funder"],
    queryFn: async () => fetch("/api/ecosystem/summary").then((r) => (r.ok ? r.json() : null)),
  });
  const metrics = data?.metrics;

  return (
    <main className="space-y-8 text-slate-100">
      <OpsPageHeader
        title="Capital operations"
        subtitle="Discover opportunities, negotiate terms, execute deals, and monitor portfolio performance — verification unlocks full investing."
        badge={
          ecosystem?.verificationStatus ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
              KYC: {String(ecosystem.verificationStatus).replace(/_/g, " ")}
            </span>
          ) : null
        }
        actions={
          <>
            <Link
              href="/funders/opportunities"
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-orange-400"
            >
              Browse opportunities
            </Link>
            <Link
              href="/funders/verification"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/[0.04]"
            >
              Verification
            </Link>
          </>
        }
      />

      <StakeholderEcosystemHome portalPrefix="/funders" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OpsMetricCard
          label="Capital deployed"
          value={`R${Number(metrics?.invested ?? 0).toLocaleString()}`}
          icon={DollarSign}
          accent="orange"
        />
        <OpsMetricCard
          label="Returned to date"
          value={`R${Number(metrics?.paidOut ?? 0).toLocaleString()}`}
          sub="Stakeholder payouts"
          icon={LineChart}
          accent="emerald"
        />
        <OpsMetricCard
          label="Pending distribution"
          value={`R${Number(metrics?.pendingPayout ?? 0).toLocaleString()}`}
          accent="amber"
        />
        <OpsMetricCard
          label="Portfolio ROI"
          value={`${Number(metrics?.roiPct ?? 0).toFixed(1)}%`}
          sub={`${ecosystem?.activeDeals ?? metrics?.activeDeals ?? 0} active deals`}
          icon={Sparkles}
          accent="violet"
        />
      </div>

      <OpsQuickActions
        items={[
          { href: "/funders/deals", label: "Deal pipeline", description: "Negotiate and track term sheets" },
          { href: "/funders/portfolio", label: "Portfolio analytics", description: "Cap table, revenue events, payouts" },
          { href: "/funders/opportunities", label: "Marketplace", description: "Curated film & series opportunities" },
        ]}
      />

      <div className="cinematic-glass rounded-2xl border border-white/8 p-5">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Operational intelligence</h2>
            <p className="mt-1 text-sm text-slate-400">
              Verification does not block browsing. After admin approval you can commit capital, receive revenue-share
              distributions, and access full deal-room tooling from the left navigation.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
