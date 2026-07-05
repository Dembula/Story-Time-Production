"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatZar } from "@/lib/format-currency-zar";

type Program = {
  id: string;
  name: string;
  description: string;
  programType: string;
  funderType: string;
  minAmount: number;
  maxAmount: number;
  status: string;
  visible: boolean;
  applicationCount: number;
};

type Application = {
  id: string;
  programTitle: string;
  projectTitle: string;
  creatorName?: string | null;
  requestedAmount?: number | null;
  notes?: string | null;
  status: string;
  submittedAt: string;
};

const emptyForm = {
  title: "",
  description: "",
  programType: "GRANT",
  funderType: "INSTITUTIONAL",
  minAmount: "",
  maxAmount: "",
  region: "",
  contactEmail: "",
  applicationDeadline: "",
  categories: "SHORT_FILM, FEATURE, DOCUMENTARY",
  requirements: "Pitch deck, Budget, Script, Production plan",
};

export default function AdminFundingProgramsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-funding-programs"],
    queryFn: () => fetch("/api/admin/funding-programs").then((r) => r.json()),
  });
  const create = useMutation({
    mutationFn: () =>
      fetch("/api/admin/funding-programs", {
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
      qc.invalidateQueries({ queryKey: ["admin-funding-programs"] });
      setForm(emptyForm);
    },
  });
  const toggle = useMutation({
    mutationFn: (payload: { id: string; status?: string; visible?: boolean }) =>
      fetch("/api/admin/funding-programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-funding-programs"] }),
  });
  const { data: appData, isLoading: appsLoading } = useQuery({
    queryKey: ["admin-funding-applications"],
    queryFn: () => fetch("/api/admin/funding-programs/applications").then((r) => r.json()),
  });
  const reviewApp = useMutation({
    mutationFn: (payload: { id: string; status: string }) =>
      fetch("/api/admin/funding-programs/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-funding-applications"] }),
  });

  const programs = (data?.programs ?? []) as Program[];
  const applications = (appData?.applications ?? []) as Application[];

  return (
    <div className="space-y-6 text-slate-100 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Funding programs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Publish institutional and Story Time funding programs that creators can apply to from the Funding Hub.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-white">New program</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Program title"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <select
            value={form.programType}
            onChange={(e) => setForm({ ...form, programType: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="GRANT">Grant</option>
            <option value="EQUITY">Equity</option>
            <option value="LOAN">Loan</option>
            <option value="SPONSORSHIP">Sponsorship</option>
            <option value="INTERNAL">Story Time internal</option>
          </select>
          <input
            type="number"
            value={form.minAmount}
            onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
            placeholder="Min amount (ZAR)"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={form.maxAmount}
            onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
            placeholder="Max amount (ZAR)"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.applicationDeadline}
            onChange={(e) => setForm({ ...form, applicationDeadline: e.target.value })}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            placeholder="Contact email"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Program description and eligibility"
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {create.isPending ? "Publishing…" : "Publish program"}
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading programs…</p>
      ) : programs.length === 0 ? (
        <p className="text-sm text-slate-500">No programs yet. Create one above.</p>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{p.name}</p>
                <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                <p className="text-xs text-orange-300 mt-2">
                  R{p.minAmount.toLocaleString()} – R{p.maxAmount.toLocaleString()} · {p.applicationCount} application(s) · {p.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggle.mutate({ id: p.id, status: p.status === "ACTIVE" ? "CLOSED" : "ACTIVE" })}
                  className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 hover:border-orange-500/50"
                >
                  {p.status === "ACTIVE" ? "Close" : "Reopen"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Program applications</h2>
        {appsLoading ? (
          <p className="text-sm text-slate-500">Loading applications…</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-slate-500">No creator applications to admin programs yet.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="rounded-lg border border-slate-800 p-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{app.projectTitle}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {app.programTitle} · {app.creatorName} ·{" "}
                    {app.requestedAmount ? formatZar(app.requestedAmount, { maximumFractionDigits: 0 }) : "—"} ·{" "}
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </p>
                  {app.notes ? <p className="text-xs text-slate-500 mt-2">{app.notes}</p> : null}
                </div>
                <select
                  value={app.status}
                  onChange={(e) => reviewApp.mutate({ id: app.id, status: e.target.value })}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                >
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under review</option>
                  <option value="CHANGES_REQUESTED">Changes requested</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
