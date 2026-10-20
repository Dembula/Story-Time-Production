"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Film, Receipt, Users } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalBarChart } from "@/components/festival/festival-bar-chart";
import { FestivalEmptyPanel } from "@/components/festival/festival-empty-panel";
import { useFestivalList } from "@/components/festival/use-active-festival";
import { FESTIVAL_CURATOR_SHARE } from "@/lib/festival/fee-split";

export default function FestivalDashboardPage() {
  const { data: festivals = [], isLoading } = useFestivalList();
  const primaryId = festivals[0]?.id || "";

  const { data: revenue } = useQuery({
    queryKey: ["festival-revenue-dash", primaryId],
    queryFn: () => fetch(`/api/festival/${primaryId}/payouts`).then((r) => r.json()),
    enabled: Boolean(primaryId),
  });

  const { data: submissions } = useQuery({
    queryKey: ["festival-submissions-dash", primaryId],
    queryFn: () => fetch(`/api/festival/${primaryId}/submissions`).then((r) => r.json()),
    enabled: Boolean(primaryId),
  });

  const totalFestivals = festivals.length;
  const liveCount = festivals.filter((f) => f.status === "LIVE").length;
  const submissionCount = festivals.reduce((n, f) => n + (f._count?.submissions ?? 0), 0);
  const teamCount = festivals.reduce((n, f) => n + (f._count?.memberships ?? 0), 0);
  const yourRevenue = Number(revenue?.summary?.yourRevenueZar ?? 0);
  const paidNow = (submissions?.submissions ?? []).length;
  const sharePct = Math.round(FESTIVAL_CURATOR_SHARE * 100);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <OpsPageHeader
        title="Festival dashboard"
        subtitle="Operations overview across your listings."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/festival/payouts"
              className="rounded-lg border border-white/12 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-orange-500/40"
            >
              Revenue
            </Link>
            <Link
              href="/festival/festivals"
              className="rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
            >
              Manage festivals
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OpsMetricCard label="Festivals" value={isLoading ? "—" : totalFestivals} icon={Film} accent="orange" />
        <OpsMetricCard label="Live" value={isLoading ? "—" : liveCount} icon={Clapperboard} accent="emerald" />
        <OpsMetricCard
          label="Submissions"
          value={isLoading ? "—" : submissionCount}
          sub={primaryId ? `${paidNow} paid in latest festival` : undefined}
          icon={Users}
          accent="cyan"
        />
        <OpsMetricCard
          label={`Your revenue (${sharePct}%)`}
          value={primaryId ? `R${yourRevenue.toFixed(2)}` : "R0.00"}
          sub="Held for remittance"
          icon={Receipt}
          accent="amber"
        />
      </div>

      {festivals.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <FestivalBarChart
            title="Festivals by status"
            bars={[
              { label: "Draft", value: festivals.filter((f) => f.status === "DRAFT").length, color: "bg-slate-500" },
              { label: "Live", value: liveCount, color: "bg-emerald-500/80" },
              {
                label: "Closed",
                value: festivals.filter((f) => f.status === "SUBMISSIONS_CLOSED").length,
                color: "bg-amber-500/70",
              },
              {
                label: "Ended",
                value: festivals.filter((f) => f.status === "ENDED").length,
                color: "bg-violet-500/70",
              },
            ]}
          />
          <FestivalBarChart
            title="Pipeline snapshot"
            bars={[
              { label: "Total submissions", value: submissionCount, color: "bg-orange-500/80" },
              { label: "Paid (active festival)", value: paidNow, color: "bg-cyan-500/80" },
              { label: "Team seats", value: teamCount, color: "bg-emerald-500/70" },
            ]}
          />
        </div>
      ) : null}

      <OpsSection title="Quick actions">
        <OpsQuickActions
          items={[
            { href: "/festival/festivals", label: "Create / edit festival", description: "Poster, categories, fees" },
            { href: "/festival/submissions", label: "Submissions queue", description: "Paid entries" },
            { href: "/festival/review", label: "Review hub", description: "Stage 1 & 2" },
            { href: "/festival/screening", label: "Screening room", description: "Official selections" },
            { href: "/festival/team", label: "Team invites", description: "Reviewers & admins" },
            { href: "/festival/wallet", label: "Wallet & KYB", description: "Payout readiness" },
          ]}
        />
      </OpsSection>

      <OpsSection title="Your festivals">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : festivals.length === 0 ? (
          <FestivalEmptyPanel
            icon={Film}
            title="Create your first festival"
            body="Set up listing details, poster, categories, and fees — then open submissions."
            actionHref="/festival/festivals"
            actionLabel="Get started"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {festivals.map((f) => (
              <Link
                key={f.id}
                href={`/festival/festivals/${f.id}`}
                className="group overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900/80 to-slate-950 transition hover:border-orange-500/30"
              >
                <div className="relative aspect-[21/7] bg-slate-900">
                  {f.headerImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.headerImageUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.18),_transparent_55%)]">
                      <Film className="h-8 w-8 text-orange-300/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold text-white">{f.name}</p>
                      {f.tagline ? <p className="truncate text-xs text-slate-300">{f.tagline}</p> : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-black/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-200 ring-1 ring-white/15">
                      {f.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-400">
                  <span>{f._count?.submissions ?? 0} submissions</span>
                  <span>{f._count?.memberships ?? 0} team</span>
                  <span>{f.acceptingSubmissions ? "Open" : "Closed"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </OpsSection>
    </div>
  );
}
