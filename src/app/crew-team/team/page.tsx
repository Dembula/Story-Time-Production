"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, Plus, Trash2, ArrowLeft, Upload } from "lucide-react";

export default function CrewTeamTeamPage() {
  const [members, setMembers] = useState<{ id: string; name: string; role: string; department: string | null; bio: string | null; photoUrl: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Crew", department: "", bio: "", photoUrl: "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/crew-team/members").then((r) => r.json()).then((arr) => { setMembers(Array.isArray(arr) ? arr : []); setLoading(false); });
  }, []);

  async function addMember() {
    if (!form.name.trim()) return;
    const res = await fetch("/api/crew-team/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, photoUrl: form.photoUrl || null }) });
    if (res.ok) {
      const m = await res.json();
      setMembers((prev) => [m, ...prev]);
      setForm({ name: "", role: "Crew", department: "", bio: "", photoUrl: "" });
      setShowForm(false);
    }
  }
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
      const data = await res.json();
      if (data.publicUrl) setForm((f) => ({ ...f, photoUrl: data.publicUrl }));
    } finally {
      setUploading(false);
    }
  }
  async function deleteMember(id: string) {
    if (!confirm("Remove this member?")) return;
    const res = await fetch(`/api/crew-team/members/${id}`, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <div className="flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/crew-team/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2"><Users className="w-7 h-7 text-emerald-500" /> My Team</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium"><Plus className="w-4 h-4" /> Add member</button>
      </div>
      {showForm && (
        <div className="mb-6 p-6 rounded-2xl bg-slate-800/50 border border-slate-600 space-y-3">
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
          <input placeholder="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
          <input placeholder="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm" />
          <textarea placeholder="Bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm resize-none" />
          <div>
            <label className="block text-sm text-slate-400 mb-1">Headshot</label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer w-fit">
              <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
            </label>
            {form.photoUrl && <span className="text-xs text-emerald-400 ml-2">Photo set</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={addMember} disabled={!form.name.trim()} className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50">Save</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button>
          </div>
        </div>
      )}
      {members.length === 0 && !showForm ? <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center text-slate-500">No team members yet.</div> : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex gap-4 justify-between">
              {m.photoUrl ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                  <Image src={m.photoUrl} alt={m.name} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
                  <Users className="w-8 h-8 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0"><p className="font-semibold text-white">{m.name}</p><p className="text-sm text-emerald-400">{m.role}{m.department ? ` · ${m.department}` : ""}</p>{m.bio && <p className="text-xs text-slate-400 mt-1">{m.bio}</p>}</div>
              <button onClick={() => deleteMember(m.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 h-fit"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
