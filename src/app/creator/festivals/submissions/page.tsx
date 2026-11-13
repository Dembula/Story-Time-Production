"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, CreditCard, Pencil } from "lucide-react";
import {
  FestivalBrowseShell,
  FestivalEmptyState,
  FestivalHeroBanner,
} from "@/components/creator/festival-browse-ui";

type SubmissionRow = {
  id: string;
  title: string;
  paymentStatus: string;
  selectionStatus: string;
  feeAmountZar: number;
  festival?: { id: string; name: string; status: string; headerImageUrl?: string | null };
  category?: { name: string };
};

export default function CreatorFestivalSubmissionsPage() {
  const qc = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["creator-festival-submissions"],
    queryFn: () => fetch("/api/creator/festivals/submissions").then((r) => r.json()),
  });

  const rows: SubmissionRow[] = data?.submissions ?? [];

  async function resumePayment(submissionId: string) {
    setPayError("");
    setPayingId(submissionId);
    try {
      const res = await fetch(`/api/creator/festivals/submissions/${submissionId}/pay`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not start payment");
      if (json.requiresPayment === true && typeof json.checkoutUrl === "string" && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      await qc.invalidateQueries({ queryKey: ["creator-festival-submissions"] });
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Could not start payment");
      setPayingId(null);
    }
  }

  return (
    <FestivalBrowseShell>
      <FestivalHeroBanner
        title="My submissions"
        subtitle="Payment and selection status across festivals."
        actions={
          <Link
            href="/creator/festivals"
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400"
          >
            Browse festivals <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {payError ? (
        <p className="mb-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {payError}
        </p>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <FestivalEmptyState
          title="No submissions yet"
          body="Browse open festivals and submit your film through Story Time."
          href="/creator/festivals"
          actionLabel="Browse festivals"
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const feeZar = Number(s.feeAmountZar);
            const feePayable = Number.isFinite(feeZar) && feeZar > 0;
            const awaiting = s.paymentStatus === "AWAITING_PAYMENT";
            const paid = s.paymentStatus === "PAID";
            const official = s.selectionStatus === "OFFICIAL_SELECTION";
            return (
              <li
                key={s.id}
                className={`cinematic-glass overflow-hidden rounded-2xl border shadow-panel ${
                  awaiting
                    ? "border-amber-400/30"
                    : official
                      ? "border-emerald-400/25"
                      : "border-white/8"
                }`}
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative h-28 w-full shrink-0 bg-slate-900 sm:h-auto sm:w-44">
                    {s.festival?.headerImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.festival.headerImageUrl}
                        alt=""
                        className="h-full w-full object-cover opacity-80"
                      />
                    ) : (
                      <div className="flex h-full min-h-[7rem] items-center justify-center bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.2),_transparent_60%)]" />
                    )}
                    {awaiting ? (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                          Payment needed
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold text-white">{s.title}</p>
                      <p className="mt-0.5 text-sm text-slate-400">
                        {s.festival?.name}
                        {s.category?.name ? ` · ${s.category.name}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            awaiting
                              ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/30"
                              : paid
                                ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/25"
                                : "bg-white/[0.05] text-slate-300 ring-1 ring-white/10"
                          }`}
                        >
                          {s.paymentStatus.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            official
                              ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/30"
                              : "bg-white/[0.05] text-slate-300 ring-1 ring-white/10"
                          }`}
                        >
                          {s.selectionStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                      {awaiting ? (
                        <p className="mt-2 text-xs text-amber-200/90">
                          {feePayable
                            ? "Edit anything that needs fixing, then complete payment to enter the festival."
                            : "This category is free. Confirm entry to finish — no payment is required."}
                        </p>
                      ) : null}
                      {s.festival?.id ? (
                        <Link
                          href={`/creator/festivals/${s.festival.id}`}
                          className="mt-2 inline-block text-xs font-medium text-orange-200 hover:text-orange-100"
                        >
                          View festival
                        </Link>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <p className="text-right text-sm font-semibold text-orange-200">
                        {feePayable ? `R${feeZar.toFixed(2)}` : "Free"}
                      </p>
                      {awaiting ? (
                        <div className="flex flex-col gap-2 sm:min-w-[10.5rem]">
                          <Link
                            href={`/creator/festivals/submissions/${s.id}/edit`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-xs font-semibold text-white hover:border-orange-400/40"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit submission
                          </Link>
                          <button
                            type="button"
                            disabled={payingId === s.id}
                            onClick={() => void resumePayment(s.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {payingId === s.id
                              ? feePayable
                                ? "Opening checkout…"
                                : "Confirming…"
                              : feePayable
                                ? "Complete payment"
                                : "Confirm free entry"}
                          </button>
                        </div>
                      ) : null}
                      {s.festival?.status === "ENDED" ? (
                        <p className="text-xs text-slate-600">Festival ended</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </FestivalBrowseShell>
  );
}
