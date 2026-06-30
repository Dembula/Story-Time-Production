"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Briefcase,
  Mail,
  Megaphone,
  DollarSign,
  Calendar,
  FileText,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions, OpsSection } from "@/components/ecosystem/ops-shell";
import { StakeholderEcosystemHome } from "@/components/ecosystem/stakeholder-ecosystem-home";

type Overview = {
  agency: { id: string; agencyName: string; counts: { talent: number; inquiries: number; castingInvitations: number; auditionSubmissions: number } };
  metrics: {
    talentTotal: number;
    availableTalent: number;
    bookedTalent: number;
    pendingInquiries: number;
    pendingInvitations: number;
    openAuditions: number;
    activeSubmissions: number;
    signedContracts: number;
    revenue: number;
  };
};

type Inquiry = {
  id: string;
  projectName: string | null;
  roleName: string | null;
  status: string;
  creator: { name: string | null };
};

type DealRow = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  status: string;
  talentName: string | null;
  createdAt: string;
  href: string;
};

export function CastingDashboardClient() {
  const [agency, setAgency] = useState<Overview["agency"] | null>(null);
  const [metrics, setMetrics] = useState<Overview["metrics"] | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/casting-agency/overview").then((r) => r.json()),
      fetch("/api/casting-agency/inquiries").then((r) => r.json()),
      fetch("/api/casting-agency/deals").then((r) => r.json()),
    ]).then(([overview, inq, dealsRes]) => {
      if (overview?.error) setLoadError(overview.error);
      else if (overview?.agency) {
        setAgency(overview.agency);
        setMetrics(overview.metrics);
      }
      setInquiries(Array.isArray(inq) ? inq : []);
      setDeals(Array.isArray(dealsRes?.pipeline) ? dealsRes.pipeline.slice(0, 6) : []);
      if (dealsRes?.error && !overview?.error) setLoadError(dealsRes.error);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!agency || !metrics) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-8 text-center">
          <Briefcase className="mx-auto mb-4 h-12 w-12 text-violet-500" />
          <h2 className="mb-2 text-xl font-semibold text-white">Set up your agency profile</h2>
          <Link
            href="/casting-agency/profile"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-2.5 font-medium text-white hover:bg-violet-600"
          >
            Create profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      <OpsPageHeader
        title={agency.agencyName}
        subtitle="Talent roster, auditions, availability, platform contracts, and deal pipeline — all in one casting command center."
      />
      {loadError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{loadError}</div>
      )}

      <StakeholderEcosystemHome portalPrefix="/casting-agency" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <OpsMetricCard label="Talent roster" value={metrics.talentTotal} icon={Users} accent="violet" sub={`${metrics.availableTalent} available · ${metrics.bookedTalent} booked`} />
        <OpsMetricCard label="Open auditions" value={metrics.openAuditions} icon={Megaphone} accent="orange" sub={`${metrics.activeSubmissions} active submissions`} />
        <OpsMetricCard label="Pending deals" value={metrics.pendingInquiries + metrics.pendingInvitations} icon={Mail} accent="amber" sub={`${metrics.pendingInquiries} inquiries · ${metrics.pendingInvitations} invites`} />
        <OpsMetricCard label="Signed contracts" value={metrics.signedContracts} icon={FileText} accent="cyan" />
        <OpsMetricCard label="Settled revenue" value={formatZar(metrics.revenue, { maximumFractionDigits: 0 })} icon={DollarSign} accent="emerald" />
      </div>

      <OpsQuickActions
        items={[
          { href: "/casting-agency/talent", label: "Talent roster", description: "Rates, commission splits, headshots & CVs" },
          { href: "/casting-agency/auditions", label: "Auditions", description: "Platform posts & who you submitted" },
          { href: "/casting-agency/availability", label: "Availability", description: "Who is free for upcoming roles" },
          { href: "/casting-agency/deals", label: "Deal pipeline", description: "Inquiries, invitations & contracts" },
          { href: "/casting-agency/contracts", label: "Contracts", description: "Story Time platform agreements" },
          { href: "/casting-agency/wallet", label: "Wallet", description: "Payouts and balances" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <OpsSection title="Recent inquiries" description="Creators reaching out to your agency">
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30">
            <div className="flex justify-between border-b border-slate-700/50 p-4">
              <span className="text-sm text-slate-400">Latest inbound</span>
              <Link href="/casting-agency/inquiries" className="text-sm text-violet-400">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-700/50">
              {inquiries.slice(0, 5).length === 0 ? (
                <div className="p-8 text-center text-slate-500">No inquiries yet.</div>
              ) : (
                inquiries.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium text-white">{r.projectName || "Project"}</p>
                      <p className="text-sm text-slate-400">
                        {r.roleName} · {r.creator?.name}
                      </p>
                    </div>
                    <span
                      className={
                        "h-fit rounded-full px-3 py-1 text-xs " +
                        (r.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400")
                      }
                    >
                      {r.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </OpsSection>

        <OpsSection title="Deal pipeline" description="Inquiries, invitations, and contracts">
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30">
            <div className="flex justify-between border-b border-slate-700/50 p-4">
              <span className="text-sm text-slate-400">Latest activity</span>
              <Link href="/casting-agency/deals" className="text-sm text-violet-400">
                Open pipeline
              </Link>
            </div>
            <div className="divide-y divide-slate-700/50">
              {deals.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No deals yet.</div>
              ) : (
                deals.map((d) => (
                  <Link key={`${d.kind}-${d.id}`} href={d.href} className="flex items-start justify-between gap-3 p-4 hover:bg-slate-800/50">
                    <div>
                      <p className="flex items-center gap-2 font-medium text-white">
                        {d.kind === "INQUIRY" && <Mail className="h-3.5 w-3.5 text-amber-400" />}
                        {d.kind === "INVITATION" && <UserCheck className="h-3.5 w-3.5 text-violet-400" />}
                        {d.kind === "CONTRACT" && <FileText className="h-3.5 w-3.5 text-cyan-400" />}
                        {d.title}
                      </p>
                      <p className="text-sm text-slate-400">{d.subtitle}</p>
                      {d.talentName && <p className="mt-0.5 text-xs text-violet-300">Talent: {d.talentName}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-700/60 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-300">
                      {d.status}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </OpsSection>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/casting-agency/availability" className="cinematic-glass flex items-center gap-3 rounded-2xl border border-white/8 p-4 hover:border-violet-500/30">
          <Calendar className="h-5 w-5 text-violet-400" />
          <div>
            <p className="font-medium text-white">Availability board</p>
            <p className="text-xs text-slate-400">Track bookings and open dates</p>
          </div>
        </Link>
        <Link href="/casting-agency/invitations" className="cinematic-glass flex items-center gap-3 rounded-2xl border border-white/8 p-4 hover:border-violet-500/30">
          <ClipboardList className="h-5 w-5 text-orange-400" />
          <div>
            <p className="font-medium text-white">Casting invitations</p>
            <p className="text-xs text-slate-400">{metrics.pendingInvitations} pending responses</p>
          </div>
        </Link>
        <Link href="/casting-agency/auditions" className="cinematic-glass flex items-center gap-3 rounded-2xl border border-white/8 p-4 hover:border-violet-500/30">
          <Megaphone className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="font-medium text-white">Audition tracker</p>
            <p className="text-xs text-slate-400">{metrics.openAuditions} open on platform</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
