"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, UserPlus } from "lucide-react";
import { readCastingApiJson } from "@/lib/casting-agency-client";
import { OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";

type TalentOption = { id: string; name: string };
type OpenAudition = {
  id: string;
  roleName: string;
  description: string | null;
  createdAt: string;
  content: { title: string };
  creator: { name: string | null };
  agencySubmissions: { id: string; status: string; talent: { id: string; name: string } }[];
};
type Submission = {
  id: string;
  status: string;
  notes: string | null;
  submittedAt: string;
  talent: { id: string; name: string; headshotUrl: string | null };
  auditionPost: {
    roleName: string;
    content: { title: string };
    creator: { name: string | null };
  };
};

const STATUS_OPTIONS = ["SUBMITTED", "SHORTLISTED", "CALLBACK", "BOOKED", "REJECTED", "WITHDRAWN"];

export default function CastingAgencyAuditionsPage() {
  const [tab, setTab] = useState<"open" | "submissions">("open");
  const [openAuditions, setOpenAuditions] = useState<OpenAudition[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [talent, setTalent] = useState<TalentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [pickTalent, setPickTalent] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  async function load() {
    setError("");
    const [audRes, talentRes] = await Promise.all([
      fetch("/api/casting-agency/auditions"),
      fetch("/api/casting-agency/talent"),
    ]);
    const { data: audData, error: audErr } = await readCastingApiJson<{
      openAuditions?: OpenAudition[];
      submissions?: Submission[];
    }>(audRes);
    if (audErr) setError(audErr);
    setOpenAuditions(Array.isArray(audData?.openAuditions) ? audData.openAuditions : []);
    setSubmissions(Array.isArray(audData?.submissions) ? audData.submissions : []);
    const { data: talentArr, error: talentErr } = await readCastingApiJson<{ id: string; name: string }[]>(talentRes);
    if (talentErr && !audErr) setError(talentErr);
    setTalent(Array.isArray(talentArr) ? talentArr.map((t) => ({ id: t.id, name: t.name })) : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitTalent(auditionPostId: string) {
    const talentId = pickTalent[auditionPostId];
    if (!talentId) return;
    setSubmitting(auditionPostId);
    setActionError("");
    const res = await fetch("/api/casting-agency/auditions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditionPostId, talentId }),
    });
    const { error: submitErr } = await readCastingApiJson(res);
    if (submitErr) setActionError(submitErr);
    else await load();
    setSubmitting(null);
  }

  async function updateSubmission(id: string, status: string) {
    setActionError("");
    const res = await fetch(`/api/casting-agency/auditions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const { error: patchErr } = await readCastingApiJson(res);
    if (patchErr) setActionError(patchErr);
    else await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <OpsPageHeader
        title="Auditions"
        subtitle="Browse open Story Time auditions and track which talent from your roster was submitted — including callbacks and bookings."
      />
      {(error || actionError) && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error || actionError}</div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setTab("open")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "open" ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-300"}`}
        >
          Open auditions ({openAuditions.length})
        </button>
        <button
          onClick={() => setTab("submissions")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "submissions" ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-300"}`}
        >
          Your submissions ({submissions.length})
        </button>
      </div>

      {tab === "open" ? (
        <OpsSection title="Platform auditions" description="Submit roster talent to open casting posts">
          <div className="space-y-4">
            {openAuditions.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500">
                No open auditions on the platform right now.
              </div>
            ) : (
              openAuditions.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-white">
                        <Megaphone className="h-4 w-4 text-violet-400" />
                        {a.roleName}
                      </p>
                      <p className="text-sm text-orange-400">for {a.content?.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Posted {new Date(a.createdAt).toLocaleDateString()} · by {a.creator?.name || "Creator"}
                      </p>
                      {a.description && <p className="mt-2 text-sm text-slate-400">{a.description}</p>}
                    </div>
                  </div>
                  {a.agencySubmissions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.agencySubmissions.map((s) => (
                        <span key={s.id} className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-200">
                          {s.talent.name} · {s.status}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <select
                      value={pickTalent[a.id] ?? ""}
                      onChange={(e) => setPickTalent((p) => ({ ...p, [a.id]: e.target.value }))}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select talent to submit</option>
                      {talent.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!pickTalent[a.id] || submitting === a.id}
                      onClick={() => submitTalent(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      {submitting === a.id ? "Submitting…" : "Submit talent"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </OpsSection>
      ) : (
        <OpsSection title="Submission tracker" description="Update status as creators progress your talent">
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500">
                No submissions yet. Submit talent from open auditions.
              </div>
            ) : (
              submissions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
                  <div>
                    <p className="font-medium text-white">{s.talent.name}</p>
                    <p className="text-sm text-slate-400">
                      {s.auditionPost.roleName} · {s.auditionPost.content?.title}
                    </p>
                    <p className="text-xs text-slate-500">Submitted {new Date(s.submittedAt).toLocaleDateString()}</p>
                  </div>
                  <select
                    value={s.status}
                    onChange={(e) => updateSubmission(s.id, e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </OpsSection>
      )}
    </div>
  );
}
