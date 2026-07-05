"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Send, DollarSign, ClipboardList } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { readCompanyApiJson } from "@/lib/casting-agency-client";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions, OpsSection } from "@/components/ecosystem/ops-shell";
import { StakeholderEcosystemHome } from "@/components/ecosystem/stakeholder-ecosystem-home";
import { SecureImage } from "@/components/files/secure-image";

export function CrewTeamDashboardClient() {
  const [teamName, setTeamName] = useState("");
  const [metrics, setMetrics] = useState({
    members: 0,
    requests: 0,
    pendingRequests: 0,
    pendingInvitations: 0,
    revenue: 0,
  });
  const [roster, setRoster] = useState<{ id: string; name: string; role: string; photoUrl: string | null; department: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/crew-team/overview")
      .then((r) => readCompanyApiJson<{
        team?: { companyName: string };
        metrics: typeof metrics;
        rosterPreview: typeof roster;
      }>(r))
      .then(({ data, error: err }) => {
        if (err) setError(err);
        if (data?.team) setTeamName(data.team.companyName);
        if (data?.metrics) setMetrics(data.metrics);
        setRoster(data?.rosterPreview ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <OpsPageHeader
        title={teamName || "Crew team"}
        subtitle="Roster with headshots and day rates, inbound hire requests, and project invitations — built for production crew companies."
      />
      {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{error}</div>}

      <StakeholderEcosystemHome portalPrefix="/crew-team" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <OpsMetricCard label="Crew members" value={metrics.members} icon={Users} accent="emerald" />
        <OpsMetricCard label="Requests" value={metrics.requests} icon={Send} accent="orange" />
        <OpsMetricCard label="Pending requests" value={metrics.pendingRequests} accent="amber" />
        <OpsMetricCard label="Pending invites" value={metrics.pendingInvitations} icon={ClipboardList} accent="violet" />
        <OpsMetricCard label="Settled revenue" value={formatZar(metrics.revenue, { maximumFractionDigits: 0 })} icon={DollarSign} accent="emerald" />
      </div>

      <OpsQuickActions
        items={[
          { href: "/crew-team/team", label: "Crew roster", description: "Photos, roles, rates, availability" },
          { href: "/crew-team/deals", label: "Jobs pipeline", description: "Requests and project invitations" },
          { href: "/crew-team/requests", label: "Request inbox", description: "Respond to creator bookings" },
          { href: "/crew-team/wallet", label: "Wallet", description: "Payouts and balances" },
        ]}
      />

      <OpsSection title="Roster preview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.length === 0 ? (
            <p className="text-slate-500 text-sm col-span-full">Add crew members with photos so creators can preview your team.</p>
          ) : (
            roster.map((m) => (
              <Link key={m.id} href="/crew-team/team" className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/30 p-3 hover:border-emerald-500/30">
                {m.photoUrl ? (
                  <SecureImage fileRef={m.photoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-700/50 text-slate-500">
                    <Users className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{m.name}</p>
                  <p className="text-xs text-emerald-300">{m.role}{m.department ? ` · ${m.department}` : ""}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </OpsSection>
    </div>
  );
}
