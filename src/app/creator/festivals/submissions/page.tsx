"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export default function CreatorFestivalSubmissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["creator-festival-submissions"],
    queryFn: () => fetch("/api/creator/festivals/submissions").then((r) => r.json()),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">My festival submissions</h1>
        <p className="mt-1 text-sm text-slate-400">Track payment and selection status across festivals.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (data?.submissions ?? []).length === 0 ? (
        <div className="rounded-2xl border border-slate-800 p-6 text-sm text-slate-400">
          No submissions yet.{" "}
          <Link href="/creator/festivals" className="text-amber-200 underline">
            Browse festivals
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {(data?.submissions ?? []).map((s: {
            id: string;
            title: string;
            paymentStatus: string;
            selectionStatus: string;
            feeAmountZar: number;
            festival?: { id: string; name: string; status: string };
            category?: { name: string };
          }) => (
            <li key={s.id} className="rounded-xl border border-slate-800 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{s.title}</p>
                  <p className="text-xs text-slate-500">
                    {s.festival?.name} · {s.category?.name}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>R{Number(s.feeAmountZar).toFixed(2)} · {s.paymentStatus}</p>
                  <p>{s.selectionStatus.replace(/_/g, " ")}</p>
                  {s.festival?.status === "ENDED" ? <p className="text-slate-500">Festival ended</p> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
