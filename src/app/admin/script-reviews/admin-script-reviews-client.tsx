"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";

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
  project: { title: string };
  requester: { name: string | null; email: string | null };
  reviewer: { name: string | null; email: string | null } | null;
};

interface Summary {
  totalRequests: number;
  totalRevenue: number;
  completed: number;
  inReview: number;
  pending: number;
}

export function AdminScriptReviewsClient() {
  const [data, setData] = useState<{ summary: Summary; requests: Request[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localFeedbackUrl, setLocalFeedbackUrl] = useState("");
  const [localFeedbackNotes, setLocalFeedbackNotes] = useState("");
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/script-reviews")
      .then((r) => r.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  const selected =
    data?.requests.find((r) => r.id === selectedId) ?? data?.requests[0] ?? null;

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
        // eslint-disable-next-line no-alert
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-height-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalRequests: 0,
    totalRevenue: 0,
    completed: 0,
    inReview: 0,
    pending: 0,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8 text-orange-500" /> Executive Script Reviews
        </h1>
        <p className="text-slate-400">
          Manage R599 Story Time Executive Script Reviews – track payments, assign reviewers, and
          send feedback back to creators.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1">Total requests</p>
          <p className="text-2xl font-bold text-white">{summary.totalRequests}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1">Total revenue (R599)</p>
          <p className="text-2xl font-bold text-orange-400">
            R{summary.totalRevenue.toFixed(2)}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-yellow-400" /> Pending
          </p>
          <p className="text-2xl font-bold text-yellow-400">{summary.pending}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Completed
          </p>
          <p className="text-2xl font-bold text-emerald-400">{summary.completed}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_minmax(0,1fr)] gap-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Project</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Requester</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Fee</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Submitted</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data?.requests.map((r) => {
                  const active = r.id === selected?.id;
                  const color =
                    r.status === "COMPLETED"
                      ? "text-emerald-400"
                      : r.status === "IN_REVIEW"
                      ? "text-sky-400"
                      : "text-yellow-400";
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-800/40 cursor-pointer ${
                        active ? "bg-slate-800/60" : ""
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="py-3 px-4 text-white font-medium">{r.project.title}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="flex flex-col">
                          <span>{r.requester.name || "—"}</span>
                          <span className="text-[11px] text-slate-500">
                            {r.requester.email ?? ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium ${color}`}>
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        R{(r.feeAmount ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(r.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-500">
                        {active ? (
                          <span className="inline-flex items-center gap-1 text-orange-300">
                            Selected <ArrowRight className="w-3 h-3" />
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
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-full">
            {selected ? (
              <>
                <h2 className="text-lg font-semibold text-white mb-1">
                  Review for {selected.project.title}
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Requested by {selected.requester.name || "—"} ({selected.requester.email || "—"})
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Status</label>
                    <div className="flex gap-2">
                      {["PENDING_ADMIN_REVIEW", "IN_REVIEW", "COMPLETED"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setLocalStatus(s)}
                          className={`px-3 py-1.5 rounded-full border text-[11px] ${
                            (localStatus ?? selected.status) === s
                              ? "bg-orange-500 border-orange-500 text-white"
                              : "bg-slate-900 border-slate-700 text-slate-300"
                          }`}
                        >
                          {s.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">
                      Feedback URL (link to PDF / Doc)
                    </label>
                    <input
                      type="url"
                      value={localFeedbackUrl}
                      onChange={(e) => setLocalFeedbackUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Feedback notes</label>
                    <textarea
                      rows={6}
                      value={localFeedbackNotes}
                      onChange={(e) => setLocalFeedbackNotes(e.target.value)}
                      placeholder="Key notes, suggestions, coverage summary..."
                      className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[11px] text-slate-500 max-w-[70%]">
                      Mark as <span className="font-semibold">COMPLETED</span> once feedback is
                      ready – creators are automatically notified.
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSave}
                      className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save & notify"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                <AlertTriangle className="w-5 h-5" />
                <p>Select a script review request from the list.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

