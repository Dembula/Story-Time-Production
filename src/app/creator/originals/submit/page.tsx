"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles, FileText, Send, Clapperboard, DollarSign, Users, AlertCircle, Upload, Loader2, CheckCircle2, ClipboardList,
} from "lucide-react";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";

type ScriptSource = "scripts" | "upload" | "url";

interface ScriptOption {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
}

interface MyPitchOption {
  id: string;
  title: string;
  status: string;
  adminNote: string | null;
  updatedAt?: string;
  reviewReasonCodes?: string | null;
  reviewWeightedScore?: number | null;
  reviewRubric?: {
    story?: number;
    marketability?: number;
    feasibility?: number;
    teamReadiness?: number;
    weightedScore?: number;
  } | null;
  submissionTimeline?: Array<{
    type: string;
    at: string;
    status?: string;
    note?: string;
    reasonCodes?: string[];
    weightedScore?: number;
  }> | null;
  resubmissionCount?: number;
}

export default function OriginalsSubmitPage() {
  const router = useRouter();
  const [myScripts, setMyScripts] = useState<ScriptOption[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [myPitches, setMyPitches] = useState<MyPitchOption[]>([]);
  const [selectedResubmitPitchId, setSelectedResubmitPitchId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPitchId, setExpandedPitchId] = useState<string | null>(null);
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

  const requiredChecks = {
    title: !!form.title.trim(),
    type: !!form.type.trim(),
    logline: !!form.logline.trim(),
    synopsis: !!form.synopsis.trim(),
    genre: !!form.genre.trim(),
    targetAudience: !!form.targetAudience.trim(),
    references: !!form.references.trim(),
    directorStatement: !!form.directorStatement.trim(),
    productionCompany: !!form.productionCompany.trim(),
    intendedRelease: !!form.intendedRelease.trim(),
    previousWorkSummary: !!form.previousWorkSummary.trim(),
    keyCastCrew: !!form.keyCastCrew.trim(),
    financingStatus: !!form.financingStatus.trim(),
    budgetEst: Number.isFinite(Number(form.budgetEst)) && Number(form.budgetEst) > 0,
  };

  useEffect(() => {
    fetch("/api/originals?type=my-scripts")
      .then((r) => r.json())
      .then((list) => setMyScripts(Array.isArray(list) ? list : []))
      .catch(() => setMyScripts([]))
      .finally(() => setLoadingScripts(false));
    fetch("/api/originals?type=pitches")
      .then((r) => r.json())
      .then((rows) => setMyPitches(Array.isArray(rows) ? rows : []))
      .catch(() => setMyPitches([]));
  }, []);

  async function uploadScriptFile(): Promise<string | null> {
    if (!scriptFile) return null;
    try {
      return await uploadContentMediaViaApi(scriptFile);
    } catch {
      return null;
    }
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
    const missingRequired = Object.entries(requiredChecks)
      .filter(([, ok]) => !ok)
      .map(([key]) => key);
    if (missingRequired.length > 0) {
      setError("Please complete all required fields in Concept, Team & context, and Budget & financing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_PITCH",
                  pitchId: selectedResubmitPitchId || undefined,
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
  const requiredComplete = Object.values(requiredChecks).every(Boolean);
  const canSubmit = requiredComplete && scriptRequired;
  const completionCount = Object.values(requiredChecks).filter(Boolean).length;
  const completionTotal = Object.values(requiredChecks).length + 1; // + script
  const completionValue = completionCount + (scriptRequired ? 1 : 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 space-y-4">
        <h1 className="text-3xl font-semibold text-white flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-orange-500" /> Story Time Originals
        </h1>
        <p className="text-slate-400 mt-1">
          Submit a complete Originals package for admin review. This intake now requires full creative, production, and financing context so reviewers can make faster, higher-quality decisions.
        </p>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-300 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-orange-400" /> Submission completeness</span>
            <span className="text-slate-400">{completionValue}/{completionTotal}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-900/70 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${Math.round((completionValue / completionTotal) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {myPitches.length > 0 && (
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">My pitch timeline</h2>
            <p className="text-sm text-slate-400">
              See all your submissions, admin scores, reason codes, and review history in one place.
            </p>
            <div className="space-y-3">
              {myPitches
                .slice()
                .sort((a, b) => (a.updatedAt && b.updatedAt ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : 0))
                .map((pitch) => (
                  <div key={pitch.id} className="rounded-lg border border-slate-700/60 bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedPitchId((prev) => (prev === pitch.id ? null : pitch.id))}
                      className="w-full text-left px-4 py-3 hover:bg-slate-800/60 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-white text-sm font-medium">{pitch.title}</p>
                          <p className="text-xs text-slate-500">
                            {pitch.status.replace(/_/g, " ")}{pitch.updatedAt ? ` - ${new Date(pitch.updatedAt).toLocaleString()}` : ""}
                          </p>
                        </div>
                        {typeof pitch.reviewWeightedScore === "number" && (
                          <span className="text-xs px-2 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-300">
                            Score: {pitch.reviewWeightedScore}/100
                          </span>
                        )}
                      </div>
                    </button>
                    {expandedPitchId === pitch.id && (
                      <div className="border-t border-slate-700/60 px-4 py-4 space-y-4">
                        {pitch.adminNote && (
                          <div className="rounded-md border border-orange-500/20 bg-orange-500/5 p-3">
                            <p className="text-xs text-orange-300 font-medium">Admin note</p>
                            <p className="text-sm text-slate-300 mt-1">{pitch.adminNote}</p>
                          </div>
                        )}
                        {pitch.reviewReasonCodes && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Reason codes</p>
                            <p className="text-sm text-slate-300">{pitch.reviewReasonCodes}</p>
                          </div>
                        )}
                        {pitch.reviewRubric && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                              ["Story", pitch.reviewRubric.story],
                              ["Marketability", pitch.reviewRubric.marketability],
                              ["Feasibility", pitch.reviewRubric.feasibility],
                              ["Team readiness", pitch.reviewRubric.teamReadiness],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-md border border-slate-700/60 bg-slate-800/40 px-2 py-1.5">
                                <p className="text-[11px] text-slate-400">{label}</p>
                                <p className="text-sm text-white">{typeof value === "number" ? `${value}/10` : "-"}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {(pitch.submissionTimeline?.length ?? 0) > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-400">Timeline</p>
                            {(pitch.submissionTimeline ?? []).map((event, idx) => (
                              <div key={`${event.type}-${event.at}-${idx}`} className="rounded-md border border-slate-700/60 bg-slate-900/50 p-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-orange-300 font-medium">{event.type}</span>
                                  <span className="text-slate-500">{new Date(event.at).toLocaleString()}</span>
                                  {event.status && <span className="text-slate-300">status: {event.status.replace(/_/g, " ")}</span>}
                                  {typeof event.weightedScore === "number" && <span className="text-emerald-300">score: {event.weightedScore}/100</span>}
                                </div>
                                {event.note && <p className="text-xs text-slate-400 mt-1">{event.note}</p>}
                                {Array.isArray(event.reasonCodes) && event.reasonCodes.length > 0 && (
                                  <p className="text-xs text-slate-400 mt-1">codes: {event.reasonCodes.join(", ")}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-slate-500">Resubmissions: {pitch.resubmissionCount ?? 0}</p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {myPitches.some((p) => p.status === "CHANGES_REQUESTED" || p.status === "DECLINED") && (
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Resubmission target (optional)</h2>
            <p className="text-sm text-slate-400">
              If this is an update to a previously reviewed pitch, select it to append to its review timeline.
            </p>
            <select
              value={selectedResubmitPitchId}
              onChange={(e) => setSelectedResubmitPitchId(e.target.value)}
              className="w-full max-w-2xl px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
            >
              <option value="">Create as a new pitch</option>
              {myPitches
                .filter((p) => p.status === "CHANGES_REQUESTED" || p.status === "DECLINED")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} - {p.status.replace(/_/g, " ")}
                  </option>
                ))}
            </select>
            {selectedResubmitPitchId && (
              <div className="text-xs text-slate-500 rounded-md border border-slate-700/60 bg-slate-900/50 p-2">
                This submission will update the selected pitch and record a RESUBMITTED event in its timeline.
              </div>
            )}
          </section>
        )}
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
              <textarea required value={form.synopsis} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} rows={6} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Detailed synopsis (act structure, conflict, emotional arc, ending)..." />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Genre *</label>
              <input required value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Drama, Thriller, Neo-noir" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target audience *</label>
              <input required value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Who is this for? (age range, market segment, region)" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">References / comparable works *</label>
              <input required value={form.references} onChange={(e) => setForm({ ...form, references: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Tsotsi, City of God — include why your project is differentiated" />
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
                      const publicUrl = await uploadContentMediaViaApi(file);
                      setForm((f) => ({ ...f, treatmentUrl: publicUrl }));
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
                      const publicUrl = await uploadContentMediaViaApi(file);
                      setForm((f) => ({ ...f, lookbookUrl: publicUrl }));
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
            <label className="block text-xs text-slate-400 mb-1">Director’s statement *</label>
            <textarea required value={form.directorStatement} onChange={(e) => setForm({ ...form, directorStatement: e.target.value })} rows={4} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Your vision, visual language, and why this story matters now..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Production company *</label>
              <input required value={form.productionCompany} onChange={(e) => setForm({ ...form, productionCompany: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Company name or producing entity" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Intended release *</label>
              <input required value={form.intendedRelease} onChange={(e) => setForm({ ...form, intendedRelease: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Theatrical, Streaming first, Festival strategy" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Previous work summary *</label>
            <textarea required value={form.previousWorkSummary} onChange={(e) => setForm({ ...form, previousWorkSummary: e.target.value })} rows={3} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Relevant credits, past releases, awards, box office or streaming impact..." />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Key cast / crew (attached or intended) *</label>
            <textarea required value={form.keyCastCrew} onChange={(e) => setForm({ ...form, keyCastCrew: e.target.value })} rows={3} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Names, roles, and current commitment status (attached / in talks / wishlist)..." />
          </div>
        </section>

        {/* --- Budget & financing --- */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-400" /> Budget & financing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estimated budget ($) *</label>
              <input required min={1} type="number" value={form.budgetEst} onChange={(e) => setForm({ ...form, budgetEst: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Financing status *</label>
              <input required value={form.financingStatus} onChange={(e) => setForm({ ...form, financingStatus: e.target.value })} className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Self-funded 30%, seeking co-production partner" />
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <p className="text-xs text-slate-400">
              Include as much specificity as possible (confirmed vs provisional funding, key risks, and timeline assumptions). Detailed submissions move faster in review.
            </p>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={!canSubmit || submitting} className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
            {submitting ? "Submitting…" : "Submit for review"} <Send className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Requires {completionTotal}/{completionTotal} completion before submit
          </span>
          <Link href="/creator/dashboard" className="text-slate-400 hover:text-white text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
