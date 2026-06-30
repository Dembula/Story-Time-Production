"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Upload,
  Loader2,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR } from "@/lib/pricing";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { StoryTimeLoader } from "@/components/ui/storytime-loader";
import { creatorToolSelect } from "@/lib/ui/creator-tool-select";

type Request = {
  id: string;
  projectId: string;
  scriptVersionId: string | null;
  requesterId: string;
  reviewerId: string | null;
  status: string;
  feeAmount: number;
  paymentId: string | null;
  feedbackUrl: string | null;
  feedbackNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  project: { id: string; title: string };
  requester: { name: string | null; email: string | null };
  reviewer: { name: string | null; email: string | null } | null;
  scriptVersion: {
    id: string;
    versionLabel: string | null;
    contentPreview: string;
    contentLength: number;
    script: { title: string };
  } | null;
  session: { id: string; draftKey: string; reviewStatus: string } | null;
};

interface Summary {
  totalRequests: number;
  totalRevenue: number;
  completed: number;
  inReview: number;
  pending: number;
  needsRevision: number;
}

const STATUS_OPTIONS = [
  "PENDING_ADMIN_REVIEW",
  "IN_REVIEW",
  "NEEDS_REVISION",
  "COMPLETED",
] as const;

function statusColor(status: string) {
  if (status === "COMPLETED") return "text-emerald-400";
  if (status === "IN_REVIEW") return "text-sky-400";
  if (status === "NEEDS_REVISION") return "text-amber-400";
  return "text-yellow-400";
}

export function AdminScriptReviewsClient({ initialRequestId }: { initialRequestId?: string }) {
  const [data, setData] = useState<{ summary: Summary; requests: Request[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialRequestId ?? null);
  const [saving, setSaving] = useState(false);
  const [localFeedbackUrl, setLocalFeedbackUrl] = useState("");
  const [localFeedbackNotes, setLocalFeedbackNotes] = useState("");
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [uploadingFeedback, setUploadingFeedback] = useState(false);

  const load = () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(`/api/admin/script-reviews${qs}`)
      .then((r) => r.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const selected = useMemo(
    () => data?.requests.find((r) => r.id === selectedId) ?? data?.requests[0] ?? null,
    [data?.requests, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id);
      setLocalFeedbackUrl(selected.feedbackUrl ?? "");
      setLocalFeedbackNotes(selected.feedbackNotes ?? "");
      setLocalStatus(selected.status);
    }
  }, [selected?.id]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/script-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status: localStatus ?? selected.status,
          feedbackUrl: localFeedbackUrl || null,
          feedbackNotes: localFeedbackNotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Failed to update review");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              requests: prev.requests.map((r) =>
                r.id === json.request.id ? { ...r, ...json.request } : r,
              ),
            }
          : prev,
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalRequests: 0,
    totalRevenue: 0,
    completed: 0,
    inReview: 0,
    pending: 0,
    needsRevision: 0,
  };

  const studioHref = selected?.scriptVersionId
    ? `/creator/projects/${selected.projectId}/pre-production/script-review?draft=project-version:${selected.scriptVersionId}&executiveRequestId=${selected.id}`
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <FileText className="h-8 w-8 text-orange-500" /> Executive Script Reviews
        </h1>
        <p className="text-slate-400">
          Paid {formatZar(EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR)} reviews arrive here after checkout. Claim a
          script, mark it up in Review Studio, upload coverage, and send results back to the creator.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <p className="mb-1 text-xs text-slate-400">In queue</p>
          <p className="text-2xl font-bold text-yellow-400">{summary.pending}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <p className="mb-1 text-xs text-slate-400">In review</p>
          <p className="text-2xl font-bold text-sky-400">{summary.inReview}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <p className="mb-1 text-xs text-slate-400">Needs revision</p>
          <p className="text-2xl font-bold text-amber-400">{summary.needsRevision}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <p className="mb-1 flex items-center gap-1 text-xs text-slate-400">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Completed
          </p>
          <p className="text-2xl font-bold text-emerald-400">{summary.completed}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
          <p className="mb-1 text-xs text-slate-400">Revenue</p>
          <p className="text-2xl font-bold text-orange-400">{formatZar(summary.totalRevenue)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-400">Filter</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={creatorToolSelect("max-w-xs text-xs")}
        >
          <option value="">All active</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.6fr_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Requester</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Submitted</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400"></th>
                </tr>
              </thead>
              <tbody>
                {data?.requests.map((r) => {
                  const active = r.id === selected?.id;
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer border-b border-slate-700/50 hover:bg-slate-800/40 ${
                        active ? "bg-slate-800/60" : ""
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="px-4 py-3 font-medium text-white">{r.project.title}</td>
                      <td className="px-4 py-3 text-slate-300">
                        <div>{r.requester.name || "—"}</div>
                        <div className="text-[11px] text-slate-500">{r.requester.email}</div>
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium ${statusColor(r.status)}`}>
                        {r.status.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(r.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-orange-300">
                        {active ? (
                          <span className="inline-flex items-center gap-1">
                            Selected <ArrowRight className="h-3 w-3" />
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-full rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            {selected ? (
              <>
                <h2 className="mb-1 text-lg font-semibold text-white">
                  {selected.project.title}
                </h2>
                <p className="mb-4 text-xs text-slate-400">
                  {selected.scriptVersion?.script.title ?? "Script"}
                  {selected.scriptVersion?.versionLabel
                    ? ` · ${selected.scriptVersion.versionLabel}`
                    : ""}{" "}
                  · {selected.requester.name} ({selected.requester.email})
                </p>

                {selected.scriptVersion?.contentPreview ? (
                  <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-3 font-mono text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                    {selected.scriptVersion.contentPreview}
                    {selected.scriptVersion.contentLength > 4000 ? (
                      <p className="mt-2 text-slate-500">… truncated preview</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mb-4 text-xs text-amber-300">No script version attached to this request.</p>
                )}

                <div className="mb-4 flex flex-wrap gap-2">
                  {studioHref ? (
                    <Link
                      href={studioHref}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-[11px] font-medium text-white hover:bg-orange-600"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in Review Studio
                    </Link>
                  ) : null}
                  {selected.paymentId ? (
                    <Link
                      href={`/admin/payments`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-2 text-[11px] text-slate-300 hover:bg-slate-900"
                    >
                      View payments
                    </Link>
                  ) : null}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="mb-1 block text-slate-400">Workflow status</label>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setLocalStatus(s)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] ${
                            (localStatus ?? selected.status) === s
                              ? "border-orange-500 bg-orange-500 text-white"
                              : "border-slate-700 bg-slate-900 text-slate-300"
                          }`}
                        >
                          {s.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      <Clock className="mr-1 inline h-3 w-3" />
                      Set <strong>IN REVIEW</strong> when you claim it. Use stamps &amp; executive layer
                      in Studio. Mark <strong>COMPLETED</strong> to notify the creator.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Feedback document (PDF or Word)</label>
                    <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-800">
                      {uploadingFeedback ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {uploadingFeedback ? "Uploading…" : "Upload file"}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf"
                        className="hidden"
                        disabled={uploadingFeedback}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadingFeedback(true);
                          try {
                            setLocalFeedbackUrl(await uploadContentMediaViaApi(file));
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setUploadingFeedback(false);
                          }
                        }}
                      />
                    </label>
                    <input
                      type="url"
                      value={localFeedbackUrl}
                      onChange={(e) => setLocalFeedbackUrl(e.target.value)}
                      placeholder="https://… feedback PDF"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Coverage / feedback notes</label>
                    <textarea
                      rows={6}
                      value={localFeedbackNotes}
                      onChange={(e) => setLocalFeedbackNotes(e.target.value)}
                      placeholder="Executive summary, revision notes, commercial assessment…"
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="max-w-[65%] text-[11px] text-slate-500">
                      {(localStatus ?? selected.status) === "NEEDS_REVISION" ? (
                        <>
                          <RotateCcw className="mr-1 inline h-3 w-3 text-amber-400" />
                          Creator is notified to revise and can resubmit later.
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-400" />
                          Completing sends feedback to the creator&apos;s Script Review Studio.
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSave}
                      className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save & notify creator"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <AlertTriangle className="h-5 w-5" />
                <p>Select a paid review from the queue.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
