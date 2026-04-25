"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles, FileText, Send, Clapperboard, DollarSign, Users, AlertCircle, Upload, Loader2,
} from "lucide-react";

type ScriptSource = "scripts" | "upload" | "url";

interface ScriptOption {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
}

export default function OriginalsSubmitPage() {
  const router = useRouter();
  const [myScripts, setMyScripts] = useState<ScriptOption[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptSource, setScriptSource] = useState<ScriptSource>("url");
  const [scriptFile, setScriptFile] = useState<File | null>(null);
  const [uploadingTreatment, setUploadingTreatment] = useState(false);
  const [uploadingLookbook, setUploadingLookbook] = useState(false);
  const [form, setForm] = useState({
    title: "",
    logline: "",
    synopsis: "",
    type: "Film",
    genre: "",
    scriptId: "",
    scriptUrl: "",
    treatmentUrl: "",
    lookbookUrl: "",
    budgetEst: "",
    targetAudience: "",
    references: "",
    directorStatement: "",
    productionCompany: "",
    previousWorkSummary: "",
    intendedRelease: "",
    keyCastCrew: "",
    financingStatus: "",
  });

  useEffect(() => {
    fetch("/api/originals?type=my-scripts")
      .then((r) => r.json())
      .then((list) => setMyScripts(Array.isArray(list) ? list : []))
      .catch(() => setMyScripts([]))
      .finally(() => setLoadingScripts(false));
  }, []);

  async function uploadScriptFile(): Promise<string | null> {
    if (!scriptFile) return null;
    const formData = new FormData();
    formData.set("file", scriptFile);
    const res = await fetch("/api/upload/content-media", { method: "POST", body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicUrl ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let scriptUrl = form.scriptUrl?.trim() || "";
    if (scriptSource === "upload" && scriptFile) {
      setSubmitting(true);
      const url = await uploadScriptFile();
      if (!url) {
        setError("Script upload failed. Try again or use an external link.");
        setSubmitting(false);
        return;
      }
      scriptUrl = url;
    }
    if (scriptSource === "scripts") {
      scriptUrl = "";
    }
    if (scriptSource === "url" && !scriptUrl) {
      setError("Please enter a script URL or upload a PDF.");
      return;
    }
    if (scriptSource === "scripts" && !form.scriptId) {
      setError("Please select one of your saved scripts.");
      return;
    }
    if (!form.title.trim() || !form.logline.trim()) {
      setError("Title and logline are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_PITCH",
          ...form,
          scriptUrl: scriptUrl || undefined,
          scriptId: scriptSource === "scripts" ? form.scriptId : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/creator/dashboard");
        return;
      }
      setError(data.error || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const scriptRequired = scriptSource === "upload" ? !!scriptFile : scriptSource === "url" ? !!form.scriptUrl?.trim() : !!form.scriptId;
  const canSubmit = form.title.trim() && form.logline.trim() && scriptRequired;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-orange-500" /> Story Time Originals
        </h1>
        <p className="text-slate-400 mt-1">
          Submit your project for consideration. A full script is required — choose from your saved scripts (Pre-Production), upload a PDF, or provide a link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {/* --- Script (required) --- */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-orange-400" /> Script (required)
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Attach a script from your saved scripts (written in Pre-Production → Script Writing), upload a PDF, or provide a link.
          </p>
          <div className="flex flex-wrap gap-4 mb-4">
            {["scripts", "upload", "url"].map((src) => (
              <label key={src} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scriptSource"
                  checked={scriptSource === src}
                  onChange={() => setScriptSource(src as ScriptSource)}
                  className="rounded-full border-slate-600 text-orange-500 focus:ring-orange-500/30 bg-slate-800"
                />
                <span className="text-sm text-slate-300">{src === "url" ? "External link" : src === "upload" ? "Upload PDF" : "From my scripts"}</span>
              </label>
            ))}
          </div>
          {scriptSource === "scripts" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Select a saved script</label>
              {loadingScripts ? (
                <p className="text-slate-500 text-sm">Loading…</p>
              ) : myScripts.length === 0 ? (
                <p className="text-amber-400/90 text-sm">
                  You don’t have any saved scripts yet. Write and save scripts in{" "}
                  <Link href="/creator/pre/script-writing" className="text-orange-400 underline hover:no-underline">Pre-Production → Script Writing</Link>
                  {" "}(link a project first), or use &quot;Upload PDF&quot; / &quot;External link&quot; here.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-2">Scripts you’ve saved in Pre-Production (Script Writing):</p>
                  <select
                    value={form.scriptId}
                    onChange={(e) => setForm({ ...form, scriptId: e.target.value })}
                    className="w-full max-w-md px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                  >
                    <option value="">Choose a script…</option>
                    {myScripts.map((s) => (
                      <option key={s.id} value={s.id}>{s.title} ({s.projectTitle})</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    <Link href="/creator/pre/script-writing" className="text-orange-400 hover:underline">Open Script Writing</Link> to create or edit scripts.
                  </p>
                </>
              )}
            </div>
          )}
          {scriptSource === "upload" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">PDF file</label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setScriptFile(e.target.files?.[0] ?? null)}
                className="block w-full max-w-md text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500/20 file:text-orange-400"
              />
              {scriptFile && <p className="text-xs text-slate-500 mt-1">{scriptFile.name}</p>}
            </div>
          )}
          {scriptSource === "url" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">External script link (PDF or doc hosted elsewhere)</label>
              <input
                type="url"
                value={form.scriptUrl}
                onChange={(e) => setForm({ ...form, scriptUrl: e.target.value })}
                placeholder="Direct https link to your script file or shared doc"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Prefer Upload PDF or From my scripts when the file is on your device or already in Story Time.</p>
            </div>
          )}
        </section>

        {/* --- Concept --- */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Clapperboard className="w-5 h-5 text-orange-400" /> Concept</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Project title" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
                <option>Film</option><option>Series</option><option>Documentary</option><option>Animated Series</option><option>Short Film</option><option>Music Video</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Logline *</label>
              <input required value={form.logline} onChange={(e) => setForm({ ...form, logline: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="One-sentence summary" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Full synopsis</label>
              <textarea value={form.synopsis} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} rows={5} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Detailed synopsis..." />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Genre</label>
              <input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Drama, Thriller" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target audience</label>
              <input value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Who is this for?" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">References / comparable works</label>
              <input value={form.references} onChange={(e) => setForm({ ...form, references: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Tsotsi, City of God" />
            </div>
          </div>
        </section>

        {/* --- Supporting materials --- */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-orange-400" /> Supporting materials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Treatment (PDF)</label>
              <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                {uploadingTreatment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingTreatment ? "Uploading…" : "Upload PDF"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={uploadingTreatment}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploadingTreatment(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
                      const data = await res.json();
                      if (data.publicUrl) setForm((f) => ({ ...f, treatmentUrl: data.publicUrl }));
                    } finally {
                      setUploadingTreatment(false);
                    }
                  }}
                />
              </label>
              <input type="url" value={form.treatmentUrl} onChange={(e) => setForm({ ...form, treatmentUrl: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Or paste a direct link to your treatment PDF" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lookbook / visual deck (PDF or images)</label>
              <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                {uploadingLookbook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingLookbook ? "Uploading…" : "Upload file"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  disabled={uploadingLookbook}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploadingLookbook(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
                      const data = await res.json();
                      if (data.publicUrl) setForm((f) => ({ ...f, lookbookUrl: data.publicUrl }));
                    } finally {
                      setUploadingLookbook(false);
                    }
                  }}
                />
              </label>
              <input type="url" value={form.lookbookUrl} onChange={(e) => setForm({ ...form, lookbookUrl: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Or paste a direct link" />
            </div>
          </div>
        </section>

        {/* --- Team & context --- */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Users className="w-5 h-5 text-orange-400" /> Team & context</h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Director’s statement</label>
            <textarea value={form.directorStatement} onChange={(e) => setForm({ ...form, directorStatement: e.target.value })} rows={3} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Your vision and why this story matters..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Production company</label>
              <input value={form.productionCompany} onChange={(e) => setForm({ ...form, productionCompany: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Company name" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Intended release</label>
              <input value={form.intendedRelease} onChange={(e) => setForm({ ...form, intendedRelease: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Theatrical, Streaming" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Previous work summary</label>
            <textarea value={form.previousWorkSummary} onChange={(e) => setForm({ ...form, previousWorkSummary: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Relevant credits or experience..." />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Key cast / crew (attached or intended)</label>
            <textarea value={form.keyCastCrew} onChange={(e) => setForm({ ...form, keyCastCrew: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Names and roles..." />
          </div>
        </section>

        {/* --- Budget & financing --- */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-400" /> Budget & financing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estimated budget ($)</label>
              <input type="number" value={form.budgetEst} onChange={(e) => setForm({ ...form, budgetEst: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Financing status</label>
              <input value={form.financingStatus} onChange={(e) => setForm({ ...form, financingStatus: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Self-funded, Seeking" />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={!canSubmit || submitting} className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
            {submitting ? "Submitting…" : "Submit for review"} <Send className="w-4 h-4" />
          </button>
          <Link href="/creator/dashboard" className="text-slate-400 hover:text-white text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
