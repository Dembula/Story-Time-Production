"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Landmark, ShieldCheck, Wallet } from "lucide-react";

const money = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function AdminPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => fetch("/api/admin/payments").then((r) => r.json()),
  });
  const [tab, setTab] = useState<"payments" | "payouts" | "escrow" | "events">("payments");

  const metrics = data?.metrics ?? {};
  const paymentRecords = (data?.paymentRecords ?? []) as any[];
  const payouts = (data?.payouts ?? []) as any[];
  const escrows = (data?.escrows ?? []) as any[];
  const gatewayEvents = (data?.gatewayEvents ?? []) as any[];

  const cards = useMemo(
    () => [
      { label: "Payment pending", value: String(metrics.paymentPending ?? 0), tone: "text-amber-300" },
      { label: "Payment succeeded", value: String(metrics.paymentSucceeded ?? 0), tone: "text-emerald-300" },
      { label: "Escrow held", value: String(metrics.escrowHeld ?? 0), tone: "text-blue-300" },
      { label: "Escrow disputed", value: String(metrics.escrowDisputed ?? 0), tone: "text-red-300" },
      { label: "Payout processing", value: String(metrics.payoutProcessing ?? 0), tone: "text-orange-300" },
      { label: "Payout failed", value: String(metrics.payoutFailed ?? 0), tone: "text-rose-300" },
      {
        label: "Platform available balance",
        value: `R${money.format(Number(metrics.platformAvailableBalance ?? 0))}`,
        tone: "text-emerald-300",
      },
      {
        label: "Gross inflow (succeeded)",
        value: `R${money.format(Number(metrics.grossInflow ?? 0))}`,
        tone: "text-cyan-300",
      },
      {
        label: "Platform charges (fees)",
        value: `R${money.format(Number(metrics.platformCharges ?? 0))}`,
        tone: "text-orange-300",
      },
      {
        label: "Payouts completed",
        value: `R${money.format(Number(metrics.payoutCompletedTotal ?? 0))}`,
        tone: "text-violet-300",
      },
      {
        label: "Net retained",
        value: `R${money.format(Number(metrics.netRetained ?? 0))}`,
        tone: "text-lime-300",
      },
    ],
    [metrics],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 text-slate-100 md:px-8 md:py-8">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Finance Ops</p>
        <h1 className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          <Wallet className="h-8 w-8 text-orange-500" />
          Payments control center
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Monitor checkout activity, payout queue, escrow lifecycle, and webhook processing from one admin workspace.
        </p>
      </header>

      {isLoading ? <p className="text-sm text-slate-400">Loading payment telemetry...</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton label="Payments" active={tab === "payments"} onClick={() => setTab("payments")} />
        <TabButton label="Payouts" active={tab === "payouts"} onClick={() => setTab("payouts")} />
        <TabButton label="Escrow" active={tab === "escrow"} onClick={() => setTab("escrow")} />
        <TabButton label="Gateway events" active={tab === "events"} onClick={() => setTab("events")} />
      </div>

      {tab === "payments" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<Landmark className="h-4 w-4 text-orange-400" />} title="Recent payments" />
          <div className="mt-3 space-y-2">
            {paymentRecords.map((p) => (
              <div key={p.id} className="grid grid-cols-[1.2fr_auto_auto_1fr] items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <span className="text-slate-200">{p.purpose}</span>
                <StatusPill value={p.status} />
                <span className="font-medium text-white">R{money.format(Number(p.amount ?? 0))}</span>
                <span className="truncate text-slate-500">{p.id}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "payouts" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<ArrowRight className="h-4 w-4 text-orange-400" />} title="Payout queue" />
          <div className="mt-3 space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <StatusPill value={p.status} />
                <span className="text-slate-300">{p.provider}</span>
                <span className="font-medium text-white">R{money.format(Number(p.amount ?? 0))}</span>
                <span className="truncate text-slate-500">{p.providerReference || p.id}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "escrow" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<ShieldCheck className="h-4 w-4 text-orange-400" />} title="Escrow accounts" />
          <div className="mt-3 space-y-2">
            {escrows.map((e) => (
              <div key={e.id} className="grid grid-cols-[1fr_auto_auto_1fr] items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <span className="text-slate-300">{e.referenceType}</span>
                <StatusPill value={e.status} />
                <span className="font-medium text-white">R{money.format(Number(e.amount ?? 0))}</span>
                <span className="truncate text-slate-500">{e.id}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "events" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<ClipboardList className="h-4 w-4 text-orange-400" />} title="Gateway events" />
          <div className="mt-3 space-y-2">
            {gatewayEvents.map((e) => (
              <div key={e.id} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${e.signatureVerified ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                  {e.signatureVerified ? "verified" : "unverified"}
                </span>
                <span className="text-slate-300">{e.eventType}</span>
                <span className={`rounded-full px-2 py-0.5 ${e.processed ? "bg-blue-500/10 text-blue-300" : "bg-amber-500/10 text-amber-300"}`}>
                  {e.processed ? "processed" : "pending"}
                </span>
                <span className="truncate text-slate-500">{e.externalEventId || e.id}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-orange-500 text-white" : "border border-slate-700/60 bg-slate-900/50 text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
      {icon}
      {title}
    </h2>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone = value === "SUCCEEDED" || value === "COMPLETED"
    ? "bg-emerald-500/10 text-emerald-300"
    : value === "FAILED" || value === "DISPUTED"
      ? "bg-red-500/10 text-red-300"
      : "bg-amber-500/10 text-amber-300";
  return <span className={`rounded-full px-2 py-0.5 ${tone}`}>{value}</span>;
}
