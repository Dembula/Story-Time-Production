"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Save, ArrowLeft } from "lucide-react";

export function CreatorAccountClient({ backHref = "/creator/dashboard" }: { backHref?: string }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    bio: "",
    socialLinks: "",
    education: "",
    goals: "",
    previousWork: "",
    headline: "",
    location: "",
    website: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((user) => {
        if (user?.email) {
          setForm({
            name: user.name ?? "",
            email: user.email ?? "",
            bio: user.bio ?? "",
            socialLinks: typeof user.socialLinks === "string" ? user.socialLinks : (user.socialLinks ? JSON.stringify(user.socialLinks, null, 2) : ""),
            education: user.education ?? "",
            goals: user.goals ?? "",
            previousWork: user.previousWork ?? "",
            headline: user.headline ?? "",
            location: user.location ?? "",
            website: user.website ?? "",
          });
        }
        setLoading(false);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    try {
      let socialLinks = form.socialLinks.trim();
      try {
        if (socialLinks) JSON.parse(socialLinks);
      } catch {
        socialLinks = JSON.stringify({ note: form.socialLinks });
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          bio: form.bio,
          socialLinks: socialLinks || undefined,
          education: form.education,
          goals: form.goals,
          previousWork: form.previousWork,
          headline: form.headline || undefined,
          location: form.location || undefined,
          website: form.website || undefined,
        }),
      });
      if (res.ok) {
        setSuccess("Profile saved.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
      <div className="flex items-center gap-3 mb-8">
        <User className="w-8 h-8 text-orange-500" />
        <div>
          <h1 className="text-2xl font-semibold text-white">Account</h1>
          <p className="text-slate-400 text-sm">View and edit your creator profile</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={save} className="space-y-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
            placeholder="Your name or studio name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
          <input value={form.email} readOnly className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-400" />
          <p className="text-xs text-slate-500 mt-1">Email cannot be changed here.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Bio</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={4}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white resize-none"
            placeholder="Tell viewers and collaborators about yourself"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Social links (JSON)</label>
          <textarea
            value={form.socialLinks}
            onChange={(e) => setForm((f) => ({ ...f, socialLinks: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white font-mono text-sm resize-none"
            placeholder='{"instagram": "@handle", "website": "https://..."}'
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Education</label>
          <input
            value={form.education}
            onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
            placeholder="e.g. Film school, courses"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Goals</label>
          <textarea
            value={form.goals}
            onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white resize-none"
            placeholder="What you're working towards"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Previous work</label>
          <textarea
            value={form.previousWork}
            onChange={(e) => setForm((f) => ({ ...f, previousWork: e.target.value }))}
            rows={3}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white resize-none"
            placeholder="Credits, past projects"
          />
        </div>
        <p className="text-slate-400 text-sm font-medium pt-2 border-t border-slate-700">Network profile (visible on your public creator page)</p>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Headline</label>
          <input
            value={form.headline}
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
            placeholder="e.g. Director · Writer · Cape Town"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
          <input
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
            placeholder="City, region or country"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Website</label>
          <input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            type="url"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
            placeholder="https://..."
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
