"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Music, ChevronRight, ChevronLeft, Check, Upload, Info } from "lucide-react";

const GENRES = ["Indie", "Electronic", "Synthwave", "Ambient", "Hip-Hop", "Afro-Electronic", "World Fusion", "Jazz", "Classical", "Rock", "Pop", "R&B", "Soul", "Folk", "Afrobeat", "Amapiano", "Gqom", "Kwaito", "Other"];
const MOODS = ["Dreamy", "Energetic", "Moody", "Peaceful", "Confident", "Nostalgic", "Spiritual", "Melancholic", "Festive", "Dark", "Uplifting", "Romantic", "Tense", "Playful"];
const KEYS = ["C Major", "C Minor", "C# Major", "C# Minor", "D Major", "D Minor", "D# Major", "D# Minor", "E Major", "E Minor", "F Major", "F Minor", "F# Major", "F# Minor", "G Major", "G Minor", "G# Major", "G# Minor", "A Major", "A Minor", "A# Major", "A# Minor", "B Major", "B Minor", "B Flat Major", "D Flat Major"];
const LICENSE_TYPES = ["SYNC", "EXCLUSIVE", "NON_EXCLUSIVE", "CREATIVE_COMMONS"];

export default function MusicUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", artistName: "", audioUrl: "", coverUrl: "",
    genre: "", mood: "", bpm: "", key: "", duration: "",
    description: "", tags: "", isrc: "", language: "", licenseType: "SYNC",
  });

  const totalSteps = 4;

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) router.push("/music-creator/dashboard");
      else { const data = await res.json(); alert(data.error || "Failed to upload"); }
    } finally { setLoading(false); }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Upload className="w-8 h-8 text-pink-500" /> Upload Music</h1>
        <p className="text-slate-400">Add a new track to your catalogue for sync licensing opportunities.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 < step ? "bg-pink-500 text-white" : i + 1 === step ? "bg-pink-500/20 text-pink-400 border border-pink-500" : "bg-slate-800 text-slate-500 border border-slate-700"}`}>
              {i + 1 < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < totalSteps - 1 && <div className={`flex-1 h-0.5 ${i + 1 < step ? "bg-pink-500" : "bg-slate-700"}`} />}
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-400">
        Step {step}: {step === 1 ? "Track Info" : step === 2 ? "Technical Details" : step === 3 ? "Media & Description" : "License & Review"}
      </p>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-5">
        {step === 1 && (<>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Track Title *</label>
            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Midnight Drive" required />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Artist / Project Name *</label>
            <input value={form.artistName} onChange={(e) => updateField("artistName", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Your artist name" required />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Genre *</label>
            <div className="flex flex-wrap gap-2">{GENRES.map((g) => (<button key={g} type="button" onClick={() => updateField("genre", g)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${form.genre === g ? "bg-pink-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>{g}</button>))}</div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Mood</label>
            <div className="flex flex-wrap gap-2">{MOODS.map((m) => (<button key={m} type="button" onClick={() => updateField("mood", m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${form.mood === m ? "bg-pink-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>{m}</button>))}</div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Language</label>
            <input value={form.language} onChange={(e) => updateField("language", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Instrumental, English, Zulu" />
          </div>
        </>)}

        {step === 2 && (<>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">BPM (Tempo)</label>
              <input type="number" value={form.bpm} onChange={(e) => updateField("bpm", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. 120" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Duration (seconds)</label>
              <input type="number" value={form.duration} onChange={(e) => updateField("duration", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. 240" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Key</label>
            <select value={form.key} onChange={(e) => updateField("key", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
              <option value="">Select key...</option>
              {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">ISRC Code (optional)</label>
            <input value={form.isrc} onChange={(e) => updateField("isrc", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. USRC17607839" />
            <p className="text-xs text-slate-500 mt-1">International Standard Recording Code — if you have one registered</p>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tags</label>
            <input value={form.tags} onChange={(e) => updateField("tags", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="cinematic, dark, ambient (comma-separated)" />
          </div>
        </>)}

        {step === 3 && (<>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Audio URL *</label>
            <input value={form.audioUrl} onChange={(e) => updateField("audioUrl", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="https://..." />
            <p className="text-xs text-slate-500 mt-1">Direct link to your audio file (MP3, WAV, FLAC)</p>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Cover Art URL</label>
            <input value={form.coverUrl} onChange={(e) => updateField("coverUrl", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="https://..." />
          </div>
          {form.coverUrl && <img src={form.coverUrl} alt="" className="w-24 h-24 rounded-lg object-cover border border-slate-700/50" />}
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={4} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Describe the track, what scenes it works for, its inspiration..." />
          </div>
        </>)}

        {step === 4 && (<>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">License Type</label>
            <div className="space-y-2">
              {LICENSE_TYPES.map((lt) => (
                <button key={lt} type="button" onClick={() => updateField("licenseType", lt)} className={`w-full text-left p-3 rounded-lg border transition ${form.licenseType === lt ? "border-pink-500 bg-pink-500/10" : "border-slate-700/50 bg-slate-800/30"}`}>
                  <p className={`text-sm font-medium ${form.licenseType === lt ? "text-pink-400" : "text-white"}`}>{lt.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500">
                    {lt === "SYNC" ? "Standard sync licensing — track can be placed in multiple productions" :
                     lt === "EXCLUSIVE" ? "One-time exclusive use — higher value, single placement" :
                     lt === "NON_EXCLUSIVE" ? "Non-exclusive — can be used by multiple creators simultaneously" :
                     "Free to use with attribution"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/30">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-pink-400" /> Review Your Track</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Title", value: form.title },
                { label: "Artist", value: form.artistName },
                { label: "Genre", value: form.genre },
                { label: "Mood", value: form.mood },
                { label: "BPM", value: form.bpm },
                { label: "Key", value: form.key },
                { label: "Duration", value: form.duration ? `${Math.floor(Number(form.duration) / 60)}:${String(Number(form.duration) % 60).padStart(2, "0")}` : "" },
                { label: "License", value: form.licenseType?.replace(/_/g, " ") },
              ].map((f) => f.value ? (
                <div key={f.label}><span className="text-slate-500">{f.label}:</span> <span className="text-slate-300">{f.value}</span></div>
              ) : null)}
            </div>
          </div>
        </>)}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < totalSteps ? (
          <button onClick={() => setStep(step + 1)} disabled={step === 1 && (!form.title || !form.artistName)} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-pink-500 text-white hover:bg-pink-600 transition disabled:opacity-50">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading || !form.title || !form.artistName} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-pink-500 text-white hover:bg-pink-600 transition disabled:opacity-50">
            <Upload className="w-4 h-4" /> {loading ? "Publishing..." : "Publish Track"}
          </button>
        )}
      </div>
    </div>
  );
}
