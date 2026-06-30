"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OpsPageHeader } from "@/components/ecosystem/ops-shell";

export default function CateringForecastPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ eventDate: "", headCount: "", lunchCount: "", specialDiets: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["catering-forecast"],
    queryFn: () => fetch("/api/catering-company/forecast").then((r) => r.json()),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      fetch("/api/catering-company/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate: form.eventDate,
          headCount: Number(form.headCount),
          lunchCount: Number(form.lunchCount || form.headCount),
          specialDiets: Number(form.specialDiets || 0),
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catering-forecast"] });
      setForm({ eventDate: "", headCount: "", lunchCount: "", specialDiets: "" });
    },
  });

  const autoMut = useMutation({
    mutationFn: () =>
      fetch("/api/catering-company/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_from_bookings" }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catering-forecast"] }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <OpsPageHeader title="Meal forecasting" subtitle="Plan headcounts, meal types, and special diets for upcoming shoot days." />
      <div className="flex gap-2">
        <button type="button" onClick={() => autoMut.mutate()} className="rounded border border-slate-600 px-3 py-2 text-xs text-slate-200">
          Auto-generate from bookings
        </button>
      </div>
      <div className="rounded-xl border border-slate-800 p-4 grid gap-3 sm:grid-cols-2">
        <input type="date" value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
        <input value={form.headCount} onChange={(e) => setForm((f) => ({ ...f, headCount: e.target.value }))} placeholder="Head count" className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
        <input value={form.lunchCount} onChange={(e) => setForm((f) => ({ ...f, lunchCount: e.target.value }))} placeholder="Lunch count" className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
        <input value={form.specialDiets} onChange={(e) => setForm((f) => ({ ...f, specialDiets: e.target.value }))} placeholder="Special diets" className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />
        <button type="button" disabled={!form.eventDate || !form.headCount} onClick={() => saveMut.mutate()} className="rounded bg-orange-500 px-3 py-2 text-xs text-white sm:col-span-2 disabled:opacity-50">
          Save forecast
        </button>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="space-y-2">
        {(data?.forecasts ?? []).map((f: { id: string; eventDate: string; headCount: number; lunchCount: number; breakfastCount: number; dinnerCount: number; specialDiets: number; status: string; project?: { title: string | null } }) => (
          <div key={f.id} className="rounded-xl border border-slate-800 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-white">{f.eventDate} · {f.headCount} guests</span>
              <span className="text-xs text-slate-500">{f.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              B{f.breakfastCount} / L{f.lunchCount} / D{f.dinnerCount} · {f.specialDiets} special diets
              {f.project?.title ? ` · ${f.project.title}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
