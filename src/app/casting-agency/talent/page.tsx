"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus, Trash2, ArrowLeft, FileText, Film, Upload } from "lucide-react";

export default function CastingAgencyTalentPage() {
  const [talent, setTalent] = useState<{ id: string; name: string; bio: string | null; cvUrl: string | null; headshotUrl: string | null; ageRange: string | null; skills: string | null; pastWork: string | null; reelUrl: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", cvUrl: "", headshotUrl: "", ageRange: "", skills: "", pastWork: "", reelUrl: "" });
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [uploadingReel, setUploadingReel] = useState(false);

  useEffect(() => {
    fetch("/api/casting-agency/talent").then((r) => r.json()).then((arr) => { setTalent(Array.isArray(arr) ? arr : []); setLoading(false); });
  }, []);

  async function addTalent() {
    if (!form.name.trim()) return;
    const res = await fetch("/api/casting-agency/talent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { const t = await res.json(); setTalent((prev) => [t, ...prev]); setForm({ name: "", bio: "", cvUrl: "", headshotUrl: "", ageRange: "", skills: "", pastWork: "", reelUrl: "" }); setShowForm(false); }
  }
  async function handleHeadshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeadshot(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
      const data = await res.json();
      if (data.publicUrl) setForm((f) => ({ ...f, headshotUrl: data.publicUrl }));
    } finally {
      setUploadingHeadshot(false);
    }
  }
  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
      const data = await res.json();
      if (data.publicUrl) setForm((f) => ({ ...f, cvUrl: data.publicUrl }));
    } finally {
      setUploadingCv(false);
    }
  }
  async function handleReelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReel(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
      const data = await res.json();
      if (data.publicUrl) setForm((f) => ({ ...f, reelUrl: data.publicUrl }));
    } finally {
      setUploadingReel(false);
    }
  }
  async function deleteTalent(id: string) {
    if (!confirm("Remove this talent?")) return;
    const res = await fetch(`/api/casting-agency/talent/${id}`, { method: "DELETE" });
    if (res.ok) setTalent((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <div className="flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Users className="w-7 h-7 text-violet-500" /> Talent</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 text-sm font-medium"><Plus className="w-4 h-4" /> Add talent</button>
      </div>
      {showForm && (
        <div className="mb-6 p-6 rounded-2xl bg-slate-800/50 border border-slate-600 space-y-3">
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
          <textarea placeholder="Bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" />
          <input placeholder="Age range" value={form.ageRange} onChange={(e) => setForm((f) => ({ ...f, ageRange: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
          <input placeholder="Skills" value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
          <textarea placeholder="Past work" value={form.pastWork} onChange={(e) => setForm((f) => ({ ...f, pastWork: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">CV (PDF)</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer shrink-0">
                <Upload className="w-4 h-4" /> {uploadingCv ? "Uploading..." : "Upload PDF"}
                <input type="file" accept="application/pdf" className="hidden" onChange={handleCvUpload} disabled={uploadingCv} />
              </label>
              <input placeholder="Or paste CV PDF link" value={form.cvUrl} onChange={(e) => setForm((f) => ({ ...f, cvUrl: e.target.value }))} className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Headshot</span>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer shrink-0">
                <Upload className="w-4 h-4" /> {uploadingHeadshot ? "Uploading..." : "Upload JPEG/PNG"}
                <input type="file" accept="image/*" className="hidden" onChange={handleHeadshotUpload} disabled={uploadingHeadshot} />
              </label>
              <input placeholder="Or paste image URL" value={form.headshotUrl} onChange={(e) => setForm((f) => ({ ...f, headshotUrl: e.target.value }))} className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Showreel (video file)</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer shrink-0">
                <Upload className="w-4 h-4" /> {uploadingReel ? "Uploading..." : "Upload video"}
                <input type="file" accept="video/*" className="hidden" onChange={handleReelUpload} disabled={uploadingReel} />
              </label>
              <input placeholder="Or paste reel / Vimeo link" value={form.reelUrl} onChange={(e) => setForm((f) => ({ ...f, reelUrl: e.target.value }))} className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            </div>
          </div>
          <div className="flex gap-2"><button onClick={addTalent} disabled={!form.name.trim()} className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium disabled:opacity-50">Save</button><button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button></div>
        </div>
      )}
      {talent.length === 0 && !showForm ? <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center text-slate-500">No talent yet.</div> : (
        <div className="space-y-4">
          {talent.map((t) => (
            <div key={t.id} className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex gap-4">
              {t.headshotUrl && <img src={t.headshotUrl} alt="" className="w-20 h-20 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{t.name}</p>
                {(t.ageRange || t.skills) && <p className="text-sm text-violet-400">{[t.ageRange, t.skills].filter(Boolean).join(" · ")}</p>}
                {t.bio && <p className="text-sm text-slate-400 mt-1">{t.bio}</p>}
                {t.pastWork && <p className="text-xs text-slate-500 mt-1">{t.pastWork}</p>}
                <div className="flex gap-3 mt-2">
                  {t.cvUrl && <a href={t.cvUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 flex items-center gap-1"><FileText className="w-3 h-3" /> CV</a>}
                  {t.reelUrl && <a href={t.reelUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 flex items-center gap-1"><Film className="w-3 h-3" /> Reel</a>}
                </div>
              </div>
              <button onClick={() => deleteTalent(t.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 h-fit"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
