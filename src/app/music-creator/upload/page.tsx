"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Music,
  ChevronRight,
  ChevronLeft,
  Check,
  Upload,
  Info,
  Loader2,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { CheckoutModal } from "@/components/payments/checkout-modal";
import { MusicTrackPreview } from "@/components/music/music-track-preview";

const GENRES = ["Indie", "Electronic", "Synthwave", "Ambient", "Hip-Hop", "Afro-Electronic", "World Fusion", "Jazz", "Classical", "Rock", "Pop", "R&B", "Soul", "Folk", "Afrobeat", "Amapiano", "Gqom", "Kwaito", "Other"];
const MOODS = ["Dreamy", "Energetic", "Moody", "Peaceful", "Confident", "Nostalgic", "Spiritual", "Melancholic", "Festive", "Dark", "Uplifting", "Romantic", "Tense", "Playful"];
const KEYS = ["C Major", "C Minor", "C# Major", "C# Minor", "D Major", "D Minor", "D# Major", "D# Minor", "E Major", "E Minor", "F Major", "F Minor", "F# Major", "F# Minor", "G Major", "G Minor", "G# Major", "G# Minor", "A Major", "A Minor", "A# Major", "A# Minor", "B Major", "B Minor", "B Flat Major", "D Flat Major"];
const LICENSE_TYPES = ["SYNC", "EXCLUSIVE", "NON_EXCLUSIVE", "CREATIVE_COMMONS"];
const USAGE_HINTS = ["Trailer", "Montage", "Romance", "Action", "Documentary", "Opening credits", "Closing credits", "Tension build", "Celebration", "Emotional reveal"];

export default function MusicUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [form, setForm] = useState({
    title: "", artistName: "", audioUrl: "", coverUrl: "",
    genre: "", mood: "", bpm: "", key: "", duration: "",
    description: "", tags: "", isrc: "", language: "", licenseType: "SYNC",
    usageScenarios: "", stemsUrl: "", instrumentalUrl: "", lyricsTheme: "",
    explicitLyrics: "NO", contactName: "", contactEmail: "", contactPhone: "",
    ownershipNotes: "",
  });
  const [rightsChecks, setRightsChecks] = useState({
    ownOrControlMaster: false,
    publishingCleared: false,
    noUnlicensedSamples: false,
    metadataAccurate: false,
  });

  const totalSteps = 5;

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    if (!rightsChecks.ownOrControlMaster || !rightsChecks.publishingCleared || !rightsChecks.noUnlicensedSamples || !rightsChecks.metadataAccurate) {
      setError("Please complete all rights and delivery confirmations.");
      return;
    }
    if (!form.contactName.trim() || !form.contactEmail.trim()) {
      setError("Release contact name and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      setError("Please enter a valid release contact email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Persist structured extras in description/tags for now (DB model unchanged).
          description: [
            form.description,
            form.usageScenarios ? `Usage scenarios: ${form.usageScenarios}` : "",
            form.lyricsTheme ? `Lyrics theme: ${form.lyricsTheme}` : "",
            form.stemsUrl ? `Stems URL: ${form.stemsUrl}` : "",
            form.instrumentalUrl ? `Instrumental URL: ${form.instrumentalUrl}` : "",
            form.ownershipNotes ? `Ownership notes: ${form.ownershipNotes}` : "",
            `Rights confirmation: master=${rightsChecks.ownOrControlMaster}; publishing=${rightsChecks.publishingCleared}; samples=${rightsChecks.noUnlicensedSamples}; metadata=${rightsChecks.metadataAccurate}`,
            `Release contact: ${form.contactName} (${form.contactEmail}${form.contactPhone ? `, ${form.contactPhone}` : ""})`,
            `Explicit lyrics: ${form.explicitLyrics}`,
          ].filter(Boolean).join("\n\n"),
          tags: [form.tags, form.explicitLyrics === "YES" ? "explicit" : "clean"].filter(Boolean).join(", "),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.requiresPayment) {
        if (typeof data?.checkoutUrl === "string" && data.checkoutUrl) {
          setCheckoutUrl(data.checkoutUrl);
          setCheckoutOpen(true);
          return;
        }
        setError("Unable to start checkout. Please try again.");
      } else if (res.ok) {
        router.push("/music-creator/dashboard");
      } else {
        setError(data.error || "Failed to upload");
      }
    } finally { setLoading(false); }
  }

  const stepReady = useMemo(() => {
    if (step === 1) return Boolean(form.title.trim() && form.artistName.trim() && form.genre);
    if (step === 2) return Boolean(form.duration.trim() && form.bpm.trim() && form.key);
    if (step === 3) return Boolean(form.audioUrl.trim());
    if (step === 4) return Boolean(form.contactName.trim() && form.contactEmail.trim());
    return true;
  }, [form, step]);

  const canSubmit =
    Boolean(form.title.trim() && form.artistName.trim() && form.audioUrl.trim()) &&
    rightsChecks.ownOrControlMaster &&
    rightsChecks.publishingCleared &&
    rightsChecks.noUnlicensedSamples &&
    rightsChecks.metadataAccurate &&
    Boolean(form.contactName.trim() && form.contactEmail.trim());

  const missingForCurrentStep = useMemo(() => {
    const missing: string[] = [];
    if (step === 1) {
      if (!form.title.trim()) missing.push("Track title");
      if (!form.artistName.trim()) missing.push("Artist name");
      if (!form.genre) missing.push("Genre");
      return missing;
    }
    if (step === 2) {
      if (!form.bpm.trim()) missing.push("BPM");
      if (!form.duration.trim()) missing.push("Duration");
      if (!form.key) missing.push("Key");
      return missing;
    }
    if (step === 3) {
      if (!form.audioUrl.trim()) missing.push("Audio file");
      return missing;
    }
    if (step === 4) {
      if (!rightsChecks.ownOrControlMaster) missing.push("Master rights confirmation");
      if (!rightsChecks.publishingCleared) missing.push("Publishing confirmation");
      if (!rightsChecks.noUnlicensedSamples) missing.push("Samples clearance confirmation");
      if (!rightsChecks.metadataAccurate) missing.push("Metadata confirmation");
      if (!form.contactName.trim()) missing.push("Release contact name");
      if (!form.contactEmail.trim()) missing.push("Release contact email");
      if (
        form.contactEmail.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())
      ) {
        missing.push("Valid contact email");
      }
      return missing;
    }
    if (!canSubmit) missing.push("Resolve all remaining requirements");
    return missing;
  }, [canSubmit, form, rightsChecks, step]);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <CheckoutModal
        open={checkoutOpen}
        checkoutUrl={checkoutUrl}
        title="Complete music upload payment"
        subtitle="Finalize secure payment to continue with this submission."
        onClose={() => setCheckoutOpen(false)}
      />
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Upload className="w-8 h-8 text-pink-500" /> Upload Music</h1>
        <p className="text-slate-400">Professional sync intake: creative identity, technicals, delivery assets, rights clearance, and final QA review.</p>
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
        Step {step}: {step === 1 ? "Creative Profile" : step === 2 ? "Technical Specs" : step === 3 ? "Assets & Packaging" : step === 4 ? "Rights & Contacts" : "QA Review"}
      </p>
      <div className="flex flex-wrap gap-2">
        {missingForCurrentStep.length > 0 ? (
          missingForCurrentStep.map((item) => (
            <span
              key={item}
              className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200"
            >
              Missing: {item}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
            All current-step requirements complete
          </span>
        )}
      </div>

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
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Scene / usage scenarios</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {USAGE_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => {
                    const current = form.usageScenarios.split(",").map((s) => s.trim()).filter(Boolean);
                    if (current.includes(hint)) return;
                    updateField("usageScenarios", [...current, hint].join(", "));
                  }}
                  className="px-2.5 py-1 rounded-md text-xs bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:border-pink-500/40"
                >
                  {hint}
                </button>
              ))}
            </div>
            <input
              value={form.usageScenarios}
              onChange={(e) => updateField("usageScenarios", e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
              placeholder="e.g. Trailer, emotional montage, end credits"
            />
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
            <label className="block text-sm text-slate-300 mb-1.5">Explicit lyrics</label>
            <select value={form.explicitLyrics} onChange={(e) => updateField("explicitLyrics", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
              <option value="NO">No (clean)</option>
              <option value="YES">Yes (explicit)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm text-slate-300 mb-1.5">Lyrics theme / content note</label>
            <input value={form.lyricsTheme} onChange={(e) => updateField("lyricsTheme", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Optional lyrical theme summary for supervisors" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tags</label>
            <input value={form.tags} onChange={(e) => updateField("tags", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="cinematic, dark, ambient (comma-separated)" />
          </div>
        </>)}

        {step === 3 && (<>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Audio file *</label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                {uploadingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingAudio ? "Uploading…" : "Upload MP3 / WAV / FLAC"}
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/aac,audio/mp4,audio/ogg,.mp3,.wav,.flac,.aac,.m4a,.ogg"
                  className="hidden"
                  disabled={uploadingAudio}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploadingAudio(true);
                    setError("");
                    try {
                      const url = await uploadContentMediaViaApi(file);
                      updateField("audioUrl", url);
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setUploadingAudio(false);
                    }
                  }}
                />
              </label>
            </div>
            <label className="block text-xs text-slate-500 mb-1">Optional: paste a direct link instead</label>
            <input value={form.audioUrl} onChange={(e) => updateField("audioUrl", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="https://… (only if not uploading)" />
            {form.audioUrl.trim() ? (
              <div className="mt-4">
                <MusicTrackPreview
                  audioUrl={form.audioUrl}
                  trackId="upload-draft"
                  title={form.title.trim() || "Upload preview"}
                  variant="bar"
                  subtitle="Preview your upload before publishing"
                />
              </div>
            ) : null}
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Cover art</label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingCover ? "Uploading…" : "Upload image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploadingCover(true);
                    setError("");
                    try {
                      const url = await uploadContentMediaViaApi(file);
                      updateField("coverUrl", url);
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setUploadingCover(false);
                    }
                  }}
                />
              </label>
            </div>
            <label className="block text-xs text-slate-500 mb-1">Optional: cover image URL</label>
            <input value={form.coverUrl} onChange={(e) => updateField("coverUrl", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="https://…" />
          </div>
          {form.coverUrl && <img src={form.coverUrl} alt="" className="w-24 h-24 rounded-lg object-cover border border-slate-700/50" />}
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={4} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Describe the track, what scenes it works for, its inspiration..." />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Instrumental version URL (optional)</label>
            <input value={form.instrumentalUrl} onChange={(e) => updateField("instrumentalUrl", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Stems / alt mixes URL (optional)</label>
            <input value={form.stemsUrl} onChange={(e) => updateField("stemsUrl", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="https://..." />
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
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4 space-y-3">
            <h4 className="text-sm font-medium text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-pink-400" /> Rights and ownership</h4>
            {[
              ["ownOrControlMaster", "I own/control the master rights for this recording."],
              ["publishingCleared", "Publishing rights are cleared for the selected license type."],
              ["noUnlicensedSamples", "No uncleared samples or copyrighted excerpts are used."],
              ["metadataAccurate", "Metadata (title, artist, ISRC, credits) is accurate."],
            ].map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-600 bg-slate-900/50 text-pink-500 focus:ring-pink-500/40"
                  checked={Boolean(rightsChecks[key as keyof typeof rightsChecks])}
                  onChange={(e) => setRightsChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Release contact name *</label>
              <input value={form.contactName} onChange={(e) => updateField("contactName", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Primary contact" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Release contact email *</label>
              <input value={form.contactEmail} onChange={(e) => updateField("contactEmail", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="name@label.com" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-1.5">Release contact phone</label>
              <input value={form.contactPhone} onChange={(e) => updateField("contactPhone", e.target.value)} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="+27 ..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-1.5">Ownership notes</label>
              <textarea value={form.ownershipNotes} onChange={(e) => updateField("ownershipNotes", e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Optional splits, publishers, and rights admin notes" />
            </div>
          </div>
        </>)}

        {step === 5 && (<>
          <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/30">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-pink-400" /> Final QA Review</h4>
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
                { label: "Audio", value: form.audioUrl ? "File attached" : "" },
                { label: "Cover", value: form.coverUrl ? "Image set" : "" },
                { label: "Usage", value: form.usageScenarios },
                { label: "Explicit", value: form.explicitLyrics === "YES" ? "Yes" : "No" },
                { label: "Contact", value: form.contactEmail },
              ].map((f) => f.value ? (
                <div key={f.label}><span className="text-slate-500">{f.label}:</span> <span className="text-slate-300">{f.value}</span></div>
              ) : null)}
            </div>
          </div>
          <div className="rounded-lg border border-pink-500/30 bg-pink-500/5 p-4 text-xs text-slate-300">
            <p className="font-medium text-pink-300 mb-1 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Pre-submit checklist</p>
            <p>
              Verify loudness/master quality, fades, metadata spelling, and rights chain before publishing.
              Approved entries move faster in sync matching and supervisor shortlisting.
            </p>
          </div>
        </>)}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < totalSteps ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!stepReady}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-pink-500 text-white hover:bg-pink-600 transition disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading || !canSubmit} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-pink-500 text-white hover:bg-pink-600 transition disabled:opacity-50">
            <Upload className="w-4 h-4" /> {loading ? "Publishing..." : "Publish Track"}
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

    </div>
  );
}
