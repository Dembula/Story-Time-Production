"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Music, Save, ArrowLeft } from "lucide-react";
import { AccountPrivacyControls } from "@/components/account/account-privacy-controls";

export default function MusicCreatorProfilePage() {
  const [form, setForm] = useState({
    professionalName: "",
    headline: "",
    bio: "",
    location: "",
    website: "",
    skills: "",
    expertiseAreas: "",
    previousWork: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => {
        if (u?.id) {
          setForm({
            professionalName: u.professionalName ?? u.name ?? "",
            headline: u.headline ?? "",
            bio: u.bio ?? "",
            location: u.location ?? "",
            website: u.website ?? "",
            skills: u.skills ?? "",
            expertiseAreas: u.expertiseAreas ?? "",
            previousWork: u.previousWork ?? "",
          });
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  if (loading) {
    return (
      <div className="flex justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/music-creator/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <Music className="w-8 h-8 text-pink-500" />
        <h1 className="text-2xl font-semibold text-white">Composer profile</h1>
      </div>
      <p className="text-sm text-slate-400 mb-8">
        How creators see you when browsing your catalogue, sync requests, and scoring placements.
      </p>

      <div className="storytime-plan-card p-6 space-y-4">
        <input
          placeholder="Artist / composer name *"
          value={form.professionalName}
          onChange={(e) => setForm((f) => ({ ...f, professionalName: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
        />
        <input
          placeholder="Headline (e.g. Film composer · Afro-soul)"
          value={form.headline}
          onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
        />
        <textarea
          placeholder="Bio"
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          rows={4}
          className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none"
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
          />
          <input
            placeholder="Website"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
          />
        </div>
        <input
          placeholder="Genres / instruments (comma-separated)"
          value={form.skills}
          onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
        />
        <input
          placeholder="Specialties (scoring, sync, production…)"
          value={form.expertiseAreas}
          onChange={(e) => setForm((f) => ({ ...f, expertiseAreas: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
        />
        <textarea
          placeholder="Credits / past work"
          value={form.previousWork}
          onChange={(e) => setForm((f) => ({ ...f, previousWork: e.target.value }))}
          rows={3}
          className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none"
        />
        {saved && <p className="text-sm text-emerald-400">Profile saved.</p>}
        <button
          onClick={save}
          disabled={saving || !form.professionalName.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-500 text-white font-medium hover:bg-pink-600 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save profile"}
        </button>
      </div>

      <AccountPrivacyControls variant="marketplace" className="mt-8" />
    </div>
  );
}
