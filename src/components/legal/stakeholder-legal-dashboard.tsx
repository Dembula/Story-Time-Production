"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { ArrowLeft, FileText } from "lucide-react";



type StakeholderContract = {

  id: string;

  type: string;

  status: string;

  subject: string | null;

  createdAt: string;

  signatureDeadline?: string | null;

  project: { id: string; title: string | null } | null;

  versions: Array<{ version: number }>;

  signers: Array<{ label: string; status: string; signOrder: number }>;

  signatures: Array<{ name: string | null; signedAt: string }>;

};



type Props = {

  portalPrefix: string;

  title?: string;

  subtitle?: string;

};



const ROLE_LABELS: Record<string, string> = {

  CASTING_AGENCY: "Casting",

  CREW_TEAM: "Crew",

  LOCATION_OWNER: "Location",

  EQUIPMENT_COMPANY: "Equipment",

  CATERING_COMPANY: "Catering",

};



export function StakeholderLegalDashboard({

  portalPrefix,

  title = "Legal & contracts",

  subtitle = "Contracts sent to you from productions on Story Time.",

}: Props) {

  const [contracts, setContracts] = useState<StakeholderContract[]>([]);

  const [role, setRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    fetch("/api/stakeholder/legal/contracts")

      .then((r) => r.json())

      .then((data) => {

        setContracts(Array.isArray(data.contracts) ? data.contracts : []);

        setRole(data.role ?? null);

        setLoading(false);

      })

      .catch(() => setLoading(false));

  }, []);



  const metrics = useMemo(() => {

    const pending = contracts.filter((c) => !["EXECUTED", "COMPLETED", "CANCELLED", "REJECTED"].includes(c.status));

    const overdue = pending.filter(

      (c) => c.signatureDeadline && new Date(c.signatureDeadline).getTime() < Date.now(),

    );

    const awaitingSignature = pending.filter((c) =>

      ["SENT", "VIEWED", "PARTIALLY_SIGNED", "AWAITING_SIGNATURE"].includes(c.status),

    );

    return {

      total: contracts.length,

      pending: pending.length,

      executed: contracts.filter((c) => ["EXECUTED", "COMPLETED"].includes(c.status)).length,

      overdue: overdue.length,

      awaitingSignature: awaitingSignature.length,

    };

  }, [contracts]);



  if (loading) {

    return (

      <div className="flex justify-center min-h-[30vh]">

        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />

      </div>

    );

  }



  return (

    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">

      <Link href={`${portalPrefix}/dashboard`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">

        <ArrowLeft className="w-4 h-4" /> Back to dashboard

      </Link>

      <div>

        <h1 className="text-2xl font-semibold text-white">{title}</h1>

        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

        {role && ROLE_LABELS[role] && (

          <p className="mt-1 text-[11px] uppercase tracking-wide text-orange-300/70">{ROLE_LABELS[role]} portal</p>

        )}

      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">

          <p className="text-xs text-slate-500">Total</p>

          <p className="text-2xl font-semibold text-white">{metrics.total}</p>

        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">

          <p className="text-xs text-amber-200/70">Awaiting action</p>

          <p className="text-2xl font-semibold text-amber-100">{metrics.pending}</p>

        </div>

        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">

          <p className="text-xs text-sky-200/70">Need signature</p>

          <p className="text-2xl font-semibold text-sky-100">{metrics.awaitingSignature}</p>

        </div>

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">

          <p className="text-xs text-rose-200/70">Overdue</p>

          <p className="text-2xl font-semibold text-rose-100">{metrics.overdue}</p>

        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

          <p className="text-xs text-emerald-200/70">Executed</p>

          <p className="text-2xl font-semibold text-emerald-100">{metrics.executed}</p>

        </div>

      </div>

      {contracts.length === 0 ? (

        <div className="rounded-2xl border border-slate-800 p-10 text-center text-sm text-slate-500">

          No contracts linked to your account yet.

        </div>

      ) : (

        <div className="space-y-3">

          {contracts.map((c) => {

            const pendingSigners = c.signers.filter((s) => s.status === "PENDING").length;

            return (

              <div key={c.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">

                <div>

                  <div className="flex items-center gap-2 text-sm text-white">

                    <FileText className="h-4 w-4 text-orange-400" />

                    {c.subject ?? c.type.replaceAll("_", " ")}

                  </div>

                  <p className="mt-1 text-xs text-slate-400">{c.project?.title ?? "Production"}</p>

                  <p className="mt-1 text-[11px] text-slate-500">

                    v{c.versions[0]?.version ?? 1} · {new Date(c.createdAt).toLocaleDateString()}

                    {pendingSigners > 0 ? ` · ${pendingSigners} signer(s) pending` : ""}

                  </p>

                </div>

                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{c.status}</span>

              </div>

            );

          })}

        </div>

      )}

      <p className="text-xs text-slate-500">

        Registered users can respond via{" "}

        <Link href="/creator/legal/inbox" className="text-orange-400 hover:text-orange-300">

          Legal inbox

        </Link>

        . Guest signers receive email links directly.

      </p>

    </div>

  );

}

