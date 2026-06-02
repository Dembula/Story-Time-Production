"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Plus, Trash2 } from "lucide-react";
import { readCastingApiJson } from "@/lib/casting-agency-client";
import { OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";

type Block = {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  projectLabel: string | null;
  notes: string | null;
  talent: { id: string; name: string; headshotUrl: string | null };
};

type RosterRow = {
  id: string;
  name: string;
  headshotUrl: string | null;
  availabilityBlocks: { id: string; status: string; startDate: string | null; projectLabel: string | null }[];
};

const STATUS_OPTIONS = ["AVAILABLE", "LIMITED", "BOOKED", "UNAVAILABLE"];

export default function CastingAgencyAvailabilityPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    talentId: "",
    status: "BOOKED",
    startDate: "",
    endDate: "",
    projectLabel: "",
    notes: "",
  });

  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/casting-agency/availability");
    const { data, error: loadErr } = await readCastingApiJson<{ blocks?: Block[]; roster?: RosterRow[] }>(res);
    if (loadErr) setError(loadErr);
    setBlocks(Array.isArray(data?.blocks) ? data.blocks : []);
    setRoster(Array.isArray(data?.roster) ? data.roster : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addBlock() {
    if (!form.talentId) return;
    setSaveError("");
    const res = await fetch("/api/casting-agency/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      }),
    });
    const { error: postErr } = await readCastingApiJson(res);
    if (postErr) setSaveError(postErr);
    else {
      setShowForm(false);
      setForm({ talentId: "", status: "BOOKED", startDate: "", endDate: "", projectLabel: "", notes: "" });
      await load();
    }
  }

  async function removeBlock(id: string) {
    if (!confirm("Remove this availability block?")) return;
    const res = await fetch(`/api/casting-agency/availability/${id}`, { method: "DELETE" });
    const { error: delErr } = await readCastingApiJson(res);
    if (delErr) setSaveError(delErr);
    else await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <OpsPageHeader
        title="Availability"
        subtitle="See who is free, limited, or booked — and log project holds so you can pitch the right talent for each role."
      />
      {(error || saveError) && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error || saveError}</div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-300"
        >
          <Plus className="h-4 w-4" /> Add booking / hold
        </button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-2xl border border-slate-600 bg-slate-800/50 p-5">
          <select
            value={form.talentId}
            onChange={(e) => setForm((f) => ({ ...f, talentId: e.target.value }))}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Select talent</option>
            {roster.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
            <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
          </div>
          <input placeholder="Project / production label" value={form.projectLabel} onChange={(e) => setForm((f) => ({ ...f, projectLabel: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
          <button onClick={addBlock} disabled={!form.talentId} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Save
          </button>
        </div>
      )}

      <OpsSection title="Roster snapshot" description="Upcoming holds per talent">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((t) => (
            <Link
              key={t.id}
              href={`/casting-agency/talent/${t.id}`}
              className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 hover:border-violet-500/30"
            >
              <div className="flex items-center gap-3">
                {t.headshotUrl ? (
                  <img src={t.headshotUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-700 text-slate-400">
                    <Calendar className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.availabilityBlocks.length} scheduled block(s)</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </OpsSection>

      <OpsSection title="All availability blocks">
        <div className="space-y-3">
          {blocks.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500">No blocks logged yet.</div>
          ) : (
            blocks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
                <div>
                  <p className="font-medium text-white">{b.talent.name}</p>
                  <p className="text-sm text-violet-300">{b.status}</p>
                  {b.projectLabel && <p className="text-sm text-slate-400">{b.projectLabel}</p>}
                  {(b.startDate || b.endDate) && (
                    <p className="text-xs text-slate-500">
                      {b.startDate ? new Date(b.startDate).toLocaleDateString() : "—"} →{" "}
                      {b.endDate ? new Date(b.endDate).toLocaleDateString() : "—"}
                    </p>
                  )}
                </div>
                <button onClick={() => removeBlock(b.id)} className="rounded-lg p-2 text-slate-400 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </OpsSection>
    </div>
  );
}
