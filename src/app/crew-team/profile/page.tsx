"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Save, ArrowLeft } from "lucide-react";

type Team = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  location: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  specializations: string | null;
  website: string | null;
  contactEmail: string | null;
  logoUrl: string | null;
  pastWorkSummary: string | null;
};

export default function CrewTeamProfilePage() {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    tagline: "",
    description: "",
    location: "",
    city: "",
    province: "",
    country: "",
    specializations: "",
    website: "",
    contactEmail: "",
    logoUrl: "",
    pastWorkSummary: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/crew-team")
      .then((r) => r.json())
      .then((t) => {
        setTeam(t);
        if (t) {
          setForm({
            companyName: t.companyName ?? "",
            tagline: t.tagline ?? "",
            description: t.description ?? "",
            location: t.location ?? "",
            city: t.city ?? "",
            province: t.province ?? "",
            country: t.country ?? "",
            specializations: t.specializations ?? "",
            website: t.website ?? "",
            contactEmail: t.contactEmail ?? "",
            logoUrl: t.logoUrl ?? "",
            pastWorkSummary: t.pastWorkSummary ?? "",
          });
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    const url = "/api/crew-team";
    const method = team ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSuccess("Profile saved.");
      setTimeout(() => setSuccess(""), 3000);
      if (!team) router.push("/crew-team/dashboard");
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/crew-team/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
      <div className="flex items-center gap-3 mb-8">
        <Briefcase className="w-8 h-8 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-semibold text-white">{team ? "Edit profile" : "Create team profile"}</h1>
          <p className="text-slate-400 text-sm">Describe your crew team so creators can find you</p>
        </div>
      </div>

      {success && <div className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">{success}</div>}

      <div className="space-y-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Company / Team name *</label>
          <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" placeholder="e.g. Cape Town Camera Crew" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Tagline</label>
          <input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" placeholder="Short one-liner" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white resize-none" placeholder="What you offer, experience, specialties..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">City</label>
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Province</label>
            <input value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Country</label>
            <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Specializations (comma-separated)</label>
          <input value={form.specializations} onChange={(e) => setForm((f) => ({ ...f, specializations: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" placeholder="Camera, Grip, Sound, Lighting" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Past work summary</label>
          <textarea value={form.pastWorkSummary} onChange={(e) => setForm((f) => ({ ...f, pastWorkSummary: e.target.value }))} rows={3} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white resize-none" placeholder="Notable projects, credits, experience..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Website</label>
            <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" type="url" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Contact email</label>
            <input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" type="email" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Logo URL</label>
          <input value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" placeholder="https://..." />
        </div>
        <div className="pt-4">
          <button onClick={save} disabled={saving || !form.companyName.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : team ? "Save changes" : "Create profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
