"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

type Company = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  specializations: string | null;
  minOrder: number | null;
  contactEmail: string | null;
  website: string | null;
} | null;

export function CateringProfileClient() {
  const router = useRouter();
  const [company, setCompany] = useState<Company>(null);
  const [form, setForm] = useState({ companyName: "", tagline: "", description: "", city: "", country: "", specializations: "", minOrder: "", contactEmail: "", website: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/catering-company/profile").then((r) => r.json()).then((c) => {
      setCompany(c);
      if (c) setForm({
        companyName: c.companyName || "",
        tagline: c.tagline || "",
        description: c.description || "",
        city: c.city || "",
        country: c.country || "",
        specializations: c.specializations || "",
        minOrder: c.minOrder != null ? String(c.minOrder) : "",
        contactEmail: c.contactEmail || "",
        website: c.website || "",
      });
    }).finally(() => setLoading(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/catering-company/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          minOrder: form.minOrder ? parseFloat(form.minOrder) : null,
        }),
      });
      if (res.ok) {
        const c = await res.json();
        setCompany(c);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold text-white mb-6 flex items-center gap-3"><UtensilsCrossed className="w-8 h-8 text-orange-500" /> Company profile</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Company name *</label>
          <input type="text" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} required className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Tagline</label>
          <input type="text" value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">City</label>
            <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Country</label>
            <input type="text" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Specializations</label>
          <input type="text" value={form.specializations} onChange={(e) => setForm((f) => ({ ...f, specializations: e.target.value }))} placeholder="e.g. Film shoots, events" className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Minimum order (ZAR)</label>
          <input type="number" value={form.minOrder} onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))} min={0} step={100} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Contact email</label>
          <input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Website</label>
          <input type="url" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
        </div>
        <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50">Save profile</button>
      </form>
    </div>
  );
}
