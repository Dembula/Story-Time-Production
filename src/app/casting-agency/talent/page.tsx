"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus, Trash2, ArrowLeft, FileText, Film, Upload } from "lucide-react";
import { readCastingApiJson } from "@/lib/casting-agency-client";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { SecureFileLink } from "@/components/files/secure-file-link";
import { SecureImage } from "@/components/files/secure-image";

type TalentRow = {
  id: string;
  name: string;
  bio: string | null;
  cvUrl: string | null;
  headshotUrl: string | null;
  ageRange: string | null;
  skills: string | null;
  pastWork: string | null;
  reelUrl: string | null;
  agencyCommissionPercent?: number | null;
  representationType?: string | null;
  profile?: {
    dailyRate?: number | null;
    availabilityStatus?: string | null;
    location?: string | null;
  };
};

export default function CastingAgencyTalentPage() {
  const [talent, setTalent] = useState<TalentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    bio: "",
    cvUrl: "",
    headshotUrl: "",
    ageRange: "",
    skills: "",
    pastWork: "",
    reelUrl: "",
    contactEmail: "",
    ethnicity: "",
    gender: "",
    agencyCommissionPercent: "",
    representationType: "NON_EXCLUSIVE",
    profile: {
      location: "",
      experienceLevel: "",
      dailyRate: "",
      projectRate: "",
      hourlyRate: "",
      weeklyRate: "",
      availability: "",
      availabilityStatus: "AVAILABLE",
      phone: "",
      agentName: "",
      unionStatus: "",
      height: "",
      eyeColor: "",
      hairColor: "",
      languages: "",
      travelWillingness: "",
      portfolioUrl: "",
    },
  });
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [uploadingReel, setUploadingReel] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/casting-agency/talent")
      .then((r) => readCastingApiJson<TalentRow[]>(r))
      .then(({ data, error: loadErr }) => {
        if (loadErr) setError(loadErr);
        setTalent(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  async function addTalent() {
    if (!form.name.trim()) return;
    setError("");
    const profile = {
      location: form.profile.location || null,
      experienceLevel: form.profile.experienceLevel || null,
      dailyRate: form.profile.dailyRate ? Number(form.profile.dailyRate) : null,
      projectRate: form.profile.projectRate ? Number(form.profile.projectRate) : null,
      hourlyRate: form.profile.hourlyRate ? Number(form.profile.hourlyRate) : null,
      weeklyRate: form.profile.weeklyRate ? Number(form.profile.weeklyRate) : null,
      availability: form.profile.availability || null,
      availabilityStatus: form.profile.availabilityStatus || null,
      phone: form.profile.phone || null,
      contactEmail: form.contactEmail || null,
      agentName: form.profile.agentName || null,
      unionStatus: form.profile.unionStatus || null,
      height: form.profile.height || null,
      eyeColor: form.profile.eyeColor || null,
      hairColor: form.profile.hairColor || null,
      ethnicity: form.ethnicity || null,
      gender: form.gender || null,
      languages: form.profile.languages.split(",").map((s) => s.trim()).filter(Boolean),
      travelWillingness: form.profile.travelWillingness || null,
      portfolioUrl: form.profile.portfolioUrl || null,
    };
    const res = await fetch("/api/casting-agency/talent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        bio: form.bio,
        cvUrl: form.cvUrl,
        headshotUrl: form.headshotUrl,
        ageRange: form.ageRange,
        skills: form.skills,
        pastWork: form.pastWork,
        reelUrl: form.reelUrl,
        contactEmail: form.contactEmail || null,
        ethnicity: form.ethnicity || null,
        gender: form.gender || null,
        agencyCommissionPercent: form.agencyCommissionPercent ? Number(form.agencyCommissionPercent) : null,
        representationType: form.representationType,
        profile,
      }),
    });
    const { data: t, error: postErr } = await readCastingApiJson<TalentRow>(res);
    if (postErr) setError(postErr);
    else if (t) {
      setTalent((prev) => [t, ...prev]);
      setForm({
        name: "",
        bio: "",
        cvUrl: "",
        headshotUrl: "",
        ageRange: "",
        skills: "",
        pastWork: "",
        reelUrl: "",
        contactEmail: "",
        ethnicity: "",
        gender: "",
        agencyCommissionPercent: "",
        representationType: "NON_EXCLUSIVE",
        profile: {
          location: "",
          experienceLevel: "",
          dailyRate: "",
          projectRate: "",
          hourlyRate: "",
          weeklyRate: "",
          availability: "",
          availabilityStatus: "AVAILABLE",
          phone: "",
          agentName: "",
          unionStatus: "",
          height: "",
          eyeColor: "",
          hairColor: "",
          languages: "",
          travelWillingness: "",
          portfolioUrl: "",
        },
      });
      setShowForm(false);
    }
  }
  async function handleHeadshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeadshot(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setForm((f) => ({ ...f, headshotUrl: publicUrl }));
    } finally {
      setUploadingHeadshot(false);
    }
  }
  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setForm((f) => ({ ...f, cvUrl: publicUrl }));
    } finally {
      setUploadingCv(false);
    }
  }
  async function handleReelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReel(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setForm((f) => ({ ...f, reelUrl: publicUrl }));
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
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}
      {showForm && (
        <div className="mb-6 p-6 storytime-plan-card space-y-4">
          <p className="text-xs text-slate-400">Complete profiles help creators compare rates, availability, and experience when browsing your roster.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input placeholder="Full name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Age range" value={form.ageRange} onChange={(e) => setForm((f) => ({ ...f, ageRange: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Ethnicity / look" value={form.ethnicity} onChange={(e) => setForm((f) => ({ ...f, ethnicity: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Location" value={form.profile.location} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, location: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Day rate (ZAR)" value={form.profile.dailyRate} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, dailyRate: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Project / buyout rate (ZAR)" value={form.profile.projectRate} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, projectRate: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Hourly rate (ZAR)" value={form.profile.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, hourlyRate: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Weekly rate (ZAR)" value={form.profile.weeklyRate} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, weeklyRate: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Agency commission %" value={form.agencyCommissionPercent} onChange={(e) => setForm((f) => ({ ...f, agencyCommissionPercent: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <select value={form.representationType} onChange={(e) => setForm((f) => ({ ...f, representationType: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm">
              <option value="EXCLUSIVE">Exclusive</option>
              <option value="NON_EXCLUSIVE">Non-exclusive</option>
              <option value="FREELANCE">Freelance</option>
            </select>
            <input placeholder="Experience level" value={form.profile.experienceLevel} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, experienceLevel: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Union status" value={form.profile.unionStatus} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, unionStatus: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Phone / WhatsApp" value={form.profile.phone} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, phone: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Agent name" value={form.profile.agentName} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, agentName: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Height" value={form.profile.height} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, height: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Eye / hair colour" value={`${form.profile.eyeColor}${form.profile.hairColor ? ` / ${form.profile.hairColor}` : ""}`} onChange={(e) => {
              const [eye, hair] = e.target.value.split("/").map((s) => s.trim());
              setForm((f) => ({ ...f, profile: { ...f.profile, eyeColor: eye ?? "", hairColor: hair ?? "" } }));
            }} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
            <input placeholder="Languages (comma-separated)" value={form.profile.languages} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, languages: e.target.value } }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm md:col-span-2" />
            <input placeholder="Skills (comma-separated)" value={form.skills} onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))} className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm md:col-span-2" />
          </div>
          <textarea placeholder="Bio / special skills summary" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" />
          <textarea placeholder="Past work / credits" value={form.pastWork} onChange={(e) => setForm((f) => ({ ...f, pastWork: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" />
          <input placeholder="Availability notes" value={form.profile.availability} onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, availability: e.target.value } }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
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
          <div className="flex gap-2"><button onClick={addTalent} disabled={!form.name.trim()} className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-50">Save talent profile</button><button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button></div>
        </div>
      )}
      {talent.length === 0 && !showForm ? <div className="storytime-plan-card p-8 text-center text-slate-500">No talent yet.</div> : (
        <div className="space-y-4">
          {talent.map((t) => (
            <div key={t.id} className="p-5 storytime-plan-card flex gap-4">
              {t.headshotUrl ? <SecureImage fileRef={t.headshotUrl} alt="" className="w-20 h-20 rounded-lg object-cover" /> : null}
              <div className="flex-1 min-w-0">
                <Link href={`/casting-agency/talent/${t.id}`} className="font-semibold text-white hover:text-violet-300">
                  {t.name}
                </Link>
                <p className="text-sm text-violet-400">
                  {[t.profile?.availabilityStatus, t.representationType?.replace("_", " "), t.agencyCommissionPercent != null ? `${t.agencyCommissionPercent}% commission` : null, t.ageRange, t.skills].filter(Boolean).join(" · ")}
                </p>
                {t.profile?.dailyRate != null && <p className="text-xs text-emerald-400/90 mt-0.5">Day rate from R{t.profile.dailyRate.toLocaleString()}</p>}
                {t.pastWork && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.pastWork}</p>}
                <div className="flex gap-3 mt-2">
                  <Link href={`/casting-agency/talent/${t.id}`} className="text-xs text-violet-400">Manage profile →</Link>
                  {t.cvUrl && <SecureFileLink fileRef={t.cvUrl} label="CV" />}
                  {t.reelUrl && <SecureFileLink fileRef={t.reelUrl} label="Reel" />}
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
