"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, Save, ArrowLeft } from "lucide-react";

export default function CastingAgencyProfilePage() {
  const router = useRouter();
  const [agency, setAgency] = useState<{ id: string; agencyName: string } | null>(null);
  const [form, setForm] = useState({ agencyName: "", tagline: "", description: "", city: "", country: "", website: "", contactEmail: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/casting-agency").then((r) => r.json()).then((a) => {
      setAgency(a);
      if (a) setForm({ agencyName: a.agencyName ?? "", tagline: a.tagline ?? "", description: a.description ?? "", city: a.city ?? "", country: a.country ?? "", website: a.website ?? "", contactEmail: a.contactEmail ?? "" });
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/casting-agency", { method: agency ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok && !agency) router.push("/casting-agency/dashboard");
  }

  if (loading) return <div className="flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <div className="flex items-center gap-3 mb-8">
        <Briefcase className="w-8 h-8 text-violet-500" />
        <div><h1 className="text-2xl font-semibold text-white">{agency ? "Edit profile" : "Create agency profile"}</h1></div>
      </div>
      <div className="space-y-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <div><label className="block text-sm font-medium text-slate-300 mb-1">Agency name *</label><input value={form.agencyName} onChange={(e) => setForm((f) => ({ ...f, agencyName: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1">Tagline</label><input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1">Description</label><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white resize-none" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-1">City</label><input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-1">Country</label><input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" /></div>
        </div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1">Website</label><input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" type="url" /></div>
        <div><label className="block text-sm font-medium text-slate-300 mb-1">Contact email</label><input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" type="email" /></div>
        <button onClick={save} disabled={saving || !form.agencyName.trim()} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 disabled:opacity-50"><Save className="w-4 h-4" /> {agency ? "Save" : "Create profile"}</button>
      </div>
    </div>
  );
}
