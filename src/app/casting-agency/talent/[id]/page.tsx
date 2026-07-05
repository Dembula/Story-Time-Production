"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Film, Save } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { readCastingApiJson } from "@/lib/casting-agency-client";
import { OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { SecureFileLink } from "@/components/files/secure-file-link";
import { SecureImage } from "@/components/files/secure-image";

type TalentDetail = {
  id: string;
  name: string;
  bio: string | null;
  cvUrl: string | null;
  headshotUrl: string | null;
  ageRange: string | null;
  skills: string | null;
  pastWork: string | null;
  reelUrl: string | null;
  agencyCommissionPercent: number | null;
  representationType: string | null;
  profile: {
    plainBio: string | null;
    dailyRate: number | null;
    projectRate: number | null;
    hourlyRate: number | null;
    weeklyRate: number | null;
    availability: string | null;
    availabilityStatus: string | null;
    location: string | null;
  };
  availabilityBlocks: { id: string; status: string; startDate: string | null; endDate: string | null; projectLabel: string | null }[];
  auditionSubmissions: { id: string; status: string; submittedAt: string; auditionPost: { roleName: string; content: { title: string } } }[];
  castingInvitations: { id: string; status: string; project: { title: string | null }; role: { name: string } }[];
  projectContracts: { id: string; status: string; type: string; project: { title: string | null } }[];
};

export default function CastingAgencyTalentDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [talent, setTalent] = useState<TalentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    plainBio: "",
    agencyCommissionPercent: "",
    representationType: "NON_EXCLUSIVE",
    dailyRate: "",
    projectRate: "",
    hourlyRate: "",
    weeklyRate: "",
    availability: "",
    availabilityStatus: "AVAILABLE",
    location: "",
  });

  useEffect(() => {
    if (!id) return;
    fetch(`/api/casting-agency/talent/${id}`)
      .then((r) => readCastingApiJson<TalentDetail>(r))
      .then(({ data, error }) => {
        if (error) setLoadError(error);
        else if (data?.id) {
          setTalent(data);
          setForm({
            name: data.name,
            plainBio: data.profile?.plainBio ?? "",
            agencyCommissionPercent: data.agencyCommissionPercent?.toString() ?? "",
            representationType: data.representationType ?? "NON_EXCLUSIVE",
            dailyRate: data.profile?.dailyRate?.toString() ?? "",
            projectRate: data.profile?.projectRate?.toString() ?? "",
            hourlyRate: data.profile?.hourlyRate?.toString() ?? "",
            weeklyRate: data.profile?.weeklyRate?.toString() ?? "",
            availability: data.profile?.availability ?? "",
            availabilityStatus: data.profile?.availabilityStatus ?? "AVAILABLE",
            location: data.profile?.location ?? "",
          });
        }
        setLoading(false);
      });
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    const commission = form.agencyCommissionPercent === "" ? null : Number(form.agencyCommissionPercent);
    if (commission !== null && (Number.isNaN(commission) || commission < 0 || commission > 100)) {
      setSaveError("Commission must be between 0 and 100.");
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/casting-agency/talent/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        bio: form.plainBio,
        agencyCommissionPercent: commission,
        representationType: form.representationType,
        profile: {
          dailyRate: form.dailyRate ? Number(form.dailyRate) : null,
          projectRate: form.projectRate ? Number(form.projectRate) : null,
          hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
          weeklyRate: form.weeklyRate ? Number(form.weeklyRate) : null,
          availability: form.availability || null,
          availabilityStatus: form.availabilityStatus,
          location: form.location || null,
          agencyCommissionPercent: commission,
        },
      }),
    });
    const { data: updated, error } = await readCastingApiJson<TalentDetail>(res);
    if (error) setSaveError(error);
    else if (updated) {
      setTalent(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!talent) {
    return (
      <div className="p-8 text-center text-slate-500">
        {loadError && <p className="mb-4 text-red-400">{loadError}</p>}
        Talent not found.{" "}
        <Link href="/casting-agency/talent" className="text-violet-400">
          Back to roster
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <Link href="/casting-agency/talent" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Talent roster
      </Link>

      <div className="flex flex-wrap items-start gap-6">
        {talent.headshotUrl ? <SecureImage fileRef={talent.headshotUrl} alt="" className="h-28 w-28 rounded-xl object-cover" /> : null}
        <OpsPageHeader title={talent.name} subtitle="Rates, agency commission, availability, auditions, and platform contracts." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OpsSection title="Representation & rates">
          <div className="space-y-3 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" placeholder="Name" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Agency commission %</label>
                <input type="number" min={0} max={100} value={form.agencyCommissionPercent} onChange={(e) => setForm((f) => ({ ...f, agencyCommissionPercent: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Representation</label>
                <select value={form.representationType} onChange={(e) => setForm((f) => ({ ...f, representationType: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
                  <option value="EXCLUSIVE">Exclusive</option>
                  <option value="NON_EXCLUSIVE">Non-exclusive</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Day rate (ZAR)</label>
                <input type="number" value={form.dailyRate} onChange={(e) => setForm((f) => ({ ...f, dailyRate: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Project rate (ZAR)</label>
                <input type="number" value={form.projectRate} onChange={(e) => setForm((f) => ({ ...f, projectRate: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Hourly rate (ZAR)</label>
                <input type="number" value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Weekly rate (ZAR)</label>
                <input type="number" value={form.weeklyRate} onChange={(e) => setForm((f) => ({ ...f, weeklyRate: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <select value={form.availabilityStatus} onChange={(e) => setForm((f) => ({ ...f, availabilityStatus: e.target.value }))} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
              <option value="AVAILABLE">Available</option>
              <option value="LIMITED">Limited</option>
              <option value="BOOKED">Booked</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
            <input value={form.availability} onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))} placeholder="Availability notes" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
            <textarea value={form.plainBio} onChange={(e) => setForm((f) => ({ ...f, plainBio: e.target.value }))} rows={3} placeholder="Bio" className="w-full resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
            {saveError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{saveError}</div>
            )}
            {saveSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">Profile saved.</div>
            )}
            <button onClick={save} disabled={saving || !form.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save profile"}
            </button>
            {(form.dailyRate || form.projectRate) && (
              <p className="text-xs text-slate-500">
                Preview: {form.dailyRate ? `Day ${formatZar(Number(form.dailyRate))}` : ""}
                {form.projectRate ? ` · Project ${formatZar(Number(form.projectRate))}` : ""}
              </p>
            )}
          </div>
        </OpsSection>

        <OpsSection title="Activity">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
              <p className="mb-2 text-sm font-medium text-white">Audition submissions</p>
              {talent.auditionSubmissions.length === 0 ? (
                <p className="text-xs text-slate-500">None yet</p>
              ) : (
                talent.auditionSubmissions.map((s) => (
                  <p key={s.id} className="text-xs text-slate-400">
                    {s.auditionPost.roleName} · {s.status}
                  </p>
                ))
              )}
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
              <p className="mb-2 text-sm font-medium text-white">Invitations</p>
              {talent.castingInvitations.length === 0 ? (
                <p className="text-xs text-slate-500">None yet</p>
              ) : (
                talent.castingInvitations.map((i) => (
                  <p key={i.id} className="text-xs text-slate-400">
                    {i.project?.title} · {i.role.name} · {i.status}
                  </p>
                ))
              )}
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
              <p className="mb-2 text-sm font-medium text-white">Contracts</p>
              {talent.projectContracts.length === 0 ? (
                <p className="text-xs text-slate-500">None yet</p>
              ) : (
                talent.projectContracts.map((c) => (
                  <p key={c.id} className="text-xs text-slate-400">
                    {c.project?.title} · {c.type} · {c.status}
                  </p>
                ))
              )}
            </div>
            <div className="flex gap-3">
              {talent.cvUrl ? <SecureFileLink fileRef={talent.cvUrl} label="CV" /> : null}
              {talent.reelUrl ? <SecureFileLink fileRef={talent.reelUrl} label="Reel" /> : null}
            </div>
            <Link href="/casting-agency/availability" className="text-sm text-violet-400">
              Manage availability blocks →
            </Link>
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
              <p className="text-xs font-medium text-orange-200">Talent portal (no login required)</p>
              <p className="mt-1 text-[11px] text-slate-400">Share a secure link so talent can view their schedule and contracts — agency-managed, no TALENT role.</p>
              <button
                type="button"
                disabled={portalLoading}
                onClick={async () => {
                  setPortalLoading(true);
                  const r = await fetch(`/api/casting-agency/talent/${id}/portal-token`, { method: "POST" });
                  const data = await r.json();
                  setPortalLoading(false);
                  if (data.url) {
                    setPortalUrl(data.url);
                    await navigator.clipboard.writeText(data.url).catch(() => {});
                  }
                }}
                className="mt-2 rounded bg-orange-500/20 px-3 py-1.5 text-xs text-orange-200 hover:bg-orange-500/30 disabled:opacity-50"
              >
                {portalLoading ? "Generating…" : "Generate & copy portal link"}
              </button>
              {portalUrl && (
                <p className="mt-2 break-all text-[10px] text-slate-500">{portalUrl}</p>
              )}
            </div>
          </div>
        </OpsSection>
      </div>
    </div>
  );
}
