"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus, Trash2, ArrowLeft, Upload } from "lucide-react";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { parseCrewMemberProfile } from "@/lib/company-marketplace-profiles";
import { SecureFileLink } from "@/components/files/secure-file-link";
import { SecureImage } from "@/components/files/secure-image";

type MemberRow = {
  id: string;
  name: string;
  role: string;
  department: string | null;
  bio: string | null;
  skills: string | null;
  pastWork: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
};

const EMPTY_FORM = {
  name: "",
  role: "Crew",
  department: "",
  bio: "",
  skills: "",
  pastWork: "",
  photoUrl: "",
  portfolioUrl: "",
  reelUrl: "",
  contactEmail: "",
  profile: {
    location: "",
    experienceLevel: "",
    dailyRate: "",
    hourlyRate: "",
    weeklyRate: "",
    projectRate: "",
    availability: "",
    phone: "",
    unionStatus: "",
    yearsExperience: "",
    tools: "",
    certifications: "",
    languages: "",
    travelWillingness: "",
    ownEquipment: "",
  },
};

export default function CrewTeamTeamPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [uploadingReel, setUploadingReel] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/crew-team/members")
      .then((r) => r.json())
      .then((arr) => {
        setMembers(Array.isArray(arr) ? arr : []);
        setLoading(false);
      });
  }, []);

  async function addMember() {
    if (!form.name.trim()) return;
    setError("");
    const profile = {
      role: form.role || null,
      department: form.department || null,
      location: form.profile.location || null,
      experienceLevel: form.profile.experienceLevel || null,
      dailyRate: form.profile.dailyRate ? Number(form.profile.dailyRate) : null,
      hourlyRate: form.profile.hourlyRate ? Number(form.profile.hourlyRate) : null,
      weeklyRate: form.profile.weeklyRate ? Number(form.profile.weeklyRate) : null,
      projectRate: form.profile.projectRate ? Number(form.profile.projectRate) : null,
      availability: form.profile.availability || null,
      phone: form.profile.phone || null,
      contactEmail: form.contactEmail || null,
      unionStatus: form.profile.unionStatus || null,
      yearsExperience: form.profile.yearsExperience ? Number(form.profile.yearsExperience) : null,
      tools: form.profile.tools.split(",").map((s) => s.trim()).filter(Boolean),
      certifications: form.profile.certifications.split(",").map((s) => s.trim()).filter(Boolean),
      languages: form.profile.languages.split(",").map((s) => s.trim()).filter(Boolean),
      travelWillingness: form.profile.travelWillingness || null,
      ownEquipment: form.profile.ownEquipment || null,
      portfolioUrl: form.portfolioUrl || null,
      reelUrl: form.reelUrl || null,
    };
    const res = await fetch("/api/crew-team/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        role: form.role,
        department: form.department || null,
        bio: form.bio || null,
        skills: form.skills || null,
        pastWork: form.pastWork || null,
        photoUrl: form.photoUrl || null,
        email: form.contactEmail || null,
        phone: form.profile.phone || null,
        profile,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMembers((prev) => [data, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } else {
      setError(data?.error || "Failed to save member");
    }
  }

  async function handleHeadshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeadshot(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setForm((f) => ({ ...f, photoUrl: publicUrl }));
    } finally {
      setUploadingHeadshot(false);
    }
  }

  async function handlePortfolioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPortfolio(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setForm((f) => ({ ...f, portfolioUrl: publicUrl }));
    } finally {
      setUploadingPortfolio(false);
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

  async function deleteMember(id: string) {
    if (!confirm("Remove this member?")) return;
    const res = await fetch(`/api/crew-team/members/${id}`, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) {
    return (
      <div className="flex justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/crew-team/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Users className="w-7 h-7 text-emerald-500" /> My Team
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add member
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {showForm && (
        <div className="mb-6 p-6 storytime-plan-card space-y-4">
          <p className="text-xs text-slate-400">
            Complete crew profiles help creators compare rates, gear, and availability when browsing your roster.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              placeholder="Full name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Contact email"
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Primary role (e.g. DOP, Gaffer)"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Department (Camera, Sound, Art…)"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Base location"
              value={form.profile.location}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, location: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Experience level"
              value={form.profile.experienceLevel}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, experienceLevel: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Years of experience"
              type="number"
              min={0}
              value={form.profile.yearsExperience}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, yearsExperience: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Union status"
              value={form.profile.unionStatus}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, unionStatus: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Day rate (ZAR)"
              value={form.profile.dailyRate}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, dailyRate: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Hourly rate (ZAR)"
              value={form.profile.hourlyRate}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, hourlyRate: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Weekly rate (ZAR)"
              value={form.profile.weeklyRate}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, weeklyRate: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Project / buyout rate (ZAR)"
              value={form.profile.projectRate}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, projectRate: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Phone / WhatsApp"
              value={form.profile.phone}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, phone: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Travel willingness"
              value={form.profile.travelWillingness}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, travelWillingness: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
            />
            <input
              placeholder="Tools / gear (comma-separated)"
              value={form.profile.tools}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, tools: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm md:col-span-2"
            />
            <input
              placeholder="Certifications (comma-separated)"
              value={form.profile.certifications}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, certifications: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm md:col-span-2"
            />
            <input
              placeholder="Languages (comma-separated)"
              value={form.profile.languages}
              onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, languages: e.target.value } }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm md:col-span-2"
            />
            <input
              placeholder="Skills (comma-separated)"
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm md:col-span-2"
            />
          </div>
          <textarea
            placeholder="Bio / summary"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none"
          />
          <textarea
            placeholder="Past work / credits"
            value={form.pastWork}
            onChange={(e) => setForm((f) => ({ ...f, pastWork: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none"
          />
          <input
            placeholder="Own equipment notes"
            value={form.profile.ownEquipment}
            onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, ownEquipment: e.target.value } }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
          />
          <input
            placeholder="Availability notes"
            value={form.profile.availability}
            onChange={(e) => setForm((f) => ({ ...f, profile: { ...f.profile, availability: e.target.value } }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
          />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Portfolio / CV (PDF)</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer shrink-0">
                <Upload className="w-4 h-4" /> {uploadingPortfolio ? "Uploading..." : "Upload PDF"}
                <input type="file" accept="application/pdf" className="hidden" onChange={handlePortfolioUpload} disabled={uploadingPortfolio} />
              </label>
              <input
                placeholder="Or paste portfolio / CV link"
                value={form.portfolioUrl}
                onChange={(e) => setForm((f) => ({ ...f, portfolioUrl: e.target.value }))}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Headshot</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer shrink-0">
                <Upload className="w-4 h-4" /> {uploadingHeadshot ? "Uploading..." : "Upload JPEG/PNG"}
                <input type="file" accept="image/*" className="hidden" onChange={handleHeadshotUpload} disabled={uploadingHeadshot} />
              </label>
              <input
                placeholder="Or paste image URL"
                value={form.photoUrl}
                onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Showreel (video file or link)</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer shrink-0">
                <Upload className="w-4 h-4" /> {uploadingReel ? "Uploading..." : "Upload video"}
                <input type="file" accept="video/*" className="hidden" onChange={handleReelUpload} disabled={uploadingReel} />
              </label>
              <input
                placeholder="Or paste reel / Vimeo link"
                value={form.reelUrl}
                onChange={(e) => setForm((f) => ({ ...f, reelUrl: e.target.value }))}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={addMember}
              disabled={!form.name.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
            >
              Save crew profile
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {members.length === 0 && !showForm ? (
        <div className="storytime-plan-card p-8 text-center text-slate-500">No team members yet.</div>
      ) : (
        <div className="space-y-4">
          {members.map((m) => {
            const parsed = parseCrewMemberProfile(m);
            const subtitle = [
              m.role,
              m.department,
              parsed.experienceLevel,
              parsed.location,
              parsed.unionStatus,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={m.id} className="p-5 storytime-plan-card flex gap-4">
                {m.photoUrl ? (
                  <SecureImage fileRef={m.photoUrl} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
                    <Users className="w-8 h-8 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{m.name}</p>
                  {subtitle && <p className="text-sm text-emerald-400">{subtitle}</p>}
                  {parsed.dailyRate != null && (
                    <p className="text-xs text-emerald-400/90 mt-0.5">Day rate from R{parsed.dailyRate.toLocaleString()}</p>
                  )}
                  {parsed.plainBio && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{parsed.plainBio}</p>}
                  {m.skills && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{m.skills}</p>}
                  {m.pastWork && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.pastWork}</p>}
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {parsed.portfolioUrl && <SecureFileLink fileRef={parsed.portfolioUrl} label="Portfolio" />}
                    {parsed.reelUrl && <SecureFileLink fileRef={parsed.reelUrl} label="Reel" />}
                  </div>
                </div>
                <button onClick={() => deleteMember(m.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 h-fit">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
