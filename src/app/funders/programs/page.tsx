"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { formatZar } from "@/lib/format-currency-zar";

const emptyForm = {
  title: "",
  description: "",
  programType: "GRANT",
  funderType: "PRIVATE",
  minAmount: "",
  maxAmount: "",
  region: "",
  contactEmail: "",
  applicationDeadline: "",
  categories: "FEATURE, SERIES",
  requirements: "Pitch deck, Budget, Distribution plan",
};

type Application = {
  id: string;
  programId: string;
  programTitle: string;
  projectTitle: string;
  projectGenre?: string | null;
  projectLogline?: string | null;
  creatorName?: string | null;
  requestedAmount?: number | null;
  notes?: string | null;
  status: string;
  adminNote?: string | null;
  submittedAt: string;
};

export default function FunderProgramsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [filterProgramId, setFilterProgramId] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["funder-programs"],
    queryFn: () => fetch("/api/funders/programs").then((r) => r.json()),
  });
  const { data: appData, isLoading: appsLoading } = useQuery({
    queryKey: ["funder-program-applications", filterProgramId],
    queryFn: () =>
      fetch(
        `/api/funders/programs/applications${filterProgramId ? `?programId=${encodeURIComponent(filterProgramId)}` : ""}`,
      ).then((r) => r.json()),
  });
  const create = useMutation({
    mutationFn: () =>
      fetch("/api/funders/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          programType: form.programType,
          funderType: form.funderType,
          minAmount: form.minAmount ? Number(form.minAmount) : null,
          maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
          region: form.region || null,
          contactEmail: form.contactEmail || null,
          applicationDeadline: form.applicationDeadline || null,
          categories: form.categories.split(",").map((s) => s.trim()).filter(Boolean),
          requirements: form.requirements.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funder-programs"] });
      setForm(emptyForm);
    },
  });
  const reviewApp = useMutation({
    mutationFn: (payload: { id: string; status: string; adminNote?: string }) =>
      fetch("/api/funders/programs/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funder-program-applications"] });
      qc.invalidateQueries({ queryKey: ["funder-programs"] });
    },
  });

  const programs = data?.programs ?? [];
  const applications = (appData?.applications ?? []) as Application[];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Funding programs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Create open calls and grant programs for creators to discover and apply through Story Time. Approving an application opens a deal room automatically.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-white">New open call</h2>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Program name"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What you fund, eligibility, timeline"
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="number"
            value={form.minAmount}
            onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
            placeholder="Min check (ZAR)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="number"
            value={form.maxAmount}
            onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
            placeholder="Max check (ZAR)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          {create.isPending ? "Creating…" : "Publish program"}
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : programs.length === 0 ? (
        <p className="text-sm text-slate-500">No programs yet.</p>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Your programs</h2>
          {programs.map((p: { id: string; name: string; description: string; minAmount: number; maxAmount: number; applicationCount: number; status: string }) => (
            <div key={p.id} className="rounded-xl border border-slate-800 p-4">
              <p className="font-medium text-white">{p.name}</p>
              <p className="text-xs text-slate-400 mt-1">{p.description}</p>
              <p className="text-xs text-orange-300 mt-2">
                R{p.minAmount?.toLocaleString()} – R{p.maxAmount?.toLocaleString()} · {p.applicationCount} applications · {p.status}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Application inbox</h2>
          <select
            value={filterProgramId}
            onChange={(e) => setFilterProgramId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
          >
            <option value="">All programs</option>
            {programs.map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {appsLoading ? (
          <p className="text-sm text-slate-500">Loading applications…</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-slate-500">No applications yet.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{app.projectTitle}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {app.programTitle} · {app.creatorName} ·{" "}
                      {app.requestedAmount ? formatZar(app.requestedAmount, { maximumFractionDigits: 0 }) : "Amount TBD"} ·{" "}
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </p>
                    {app.projectLogline ? <p className="text-xs text-slate-500 mt-2">{app.projectLogline}</p> : null}
                    {app.notes ? <p className="text-xs text-slate-400 mt-2">{app.notes}</p> : null}
                  </div>
                  <select
                    value={app.status}
                    onChange={(e) => reviewApp.mutate({ id: app.id, status: e.target.value })}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                  >
                    <option value="SUBMITTED">Submitted</option>
                    <option value="UNDER_REVIEW">Under review</option>
                    <option value="CHANGES_REQUESTED">Changes requested</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                {app.status === "APPROVED" ? (
                  <p className="mt-2 text-[11px] text-emerald-300">
                    Deal room opened — continue in{" "}
                    <Link href="/funders/deals" className="underline hover:text-emerald-200">
                      Deal Engine
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
