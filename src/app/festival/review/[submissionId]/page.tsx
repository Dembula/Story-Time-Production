"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalScreenerPlayer } from "@/components/festival/festival-screener-player";

export default function FestivalSubmissionReviewPage() {
  const params = useParams();
  const submissionId = String(params.submissionId);
  const qc = useQueryClient();
  const [watchTab, setWatchTab] = useState<"screener" | "trailer">("screener");
  const [group, setGroup] = useState<"A" | "B" | "C">("B");
  const [escalateFlag, setEscalateFlag] = useState(false);
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [overallThoughts, setOverallThoughts] = useState("");
  const [acceptReason, setAcceptReason] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [craftNotes, setCraftNotes] = useState("");
  const [recommendation, setRecommendation] = useState("PENDING_APPROVAL");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["festival-submission-review", submissionId],
    queryFn: () => fetch(`/api/festival/submissions/${submissionId}/review`).then((r) => r.json()),
  });

  const stage1 = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/festival/submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "STAGE1",
          group,
          escalateFlag,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      setMessage("Stage 1 saved.");
      qc.invalidateQueries({ queryKey: ["festival-submission-review", submissionId] });
      qc.invalidateQueries({ queryKey: ["festival-submissions"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const stage2 = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/festival/submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "STAGE2",
          overallThoughts,
          acceptReason,
          declineReason,
          craftNotes,
          recommendation,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      setMessage("Stage 2 decision saved.");
      qc.invalidateQueries({ queryKey: ["festival-submission-review", submissionId] });
      qc.invalidateQueries({ queryKey: ["festival-submissions"] });
      qc.invalidateQueries({ queryKey: ["festival-screening"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  if (isLoading || !data?.submission) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const s = data.submission;
  const activeUrl = watchTab === "trailer" ? s.trailerUrl : s.screenerUrl;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <OpsPageHeader
        title={s.title}
        subtitle={`${s.festival?.name} · ${s.category?.name} · ${s.selectionStatus?.replace(/_/g, " ")}`}
        actions={
          <Link
            href="/festival/review"
            className="rounded-lg border border-white/12 px-3 py-2 text-sm text-slate-300"
          >
            Back to hub
          </Link>
        }
      />

      <OpsSection title="Watch before you decide">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWatchTab("screener")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              watchTab === "screener" ? "bg-orange-500 text-white" : "border border-white/10 text-slate-400"
            }`}
          >
            Screener
          </button>
          <button
            type="button"
            onClick={() => setWatchTab("trailer")}
            disabled={!s.trailerUrl}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
              watchTab === "trailer" ? "bg-orange-500 text-white" : "border border-white/10 text-slate-400"
            }`}
          >
            Trailer
          </button>
        </div>
        <FestivalScreenerPlayer url={activeUrl} title={s.title} />
        <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Filmmaker:</span>{" "}
            {s.creator?.name || s.creator?.email || "—"}
          </p>
          <p>
            <span className="text-slate-500">Stage:</span> {s.reviewStage}
            {s.stage1Group ? ` · Group ${s.stage1Group}` : ""}
          </p>
        </div>
      </OpsSection>

      {s.logline ? <p className="text-sm italic text-slate-300">{s.logline}</p> : null}
      {s.synopsis ? (
        <OpsSection title="Synopsis">
          <p className="whitespace-pre-wrap text-sm text-slate-400">{s.synopsis}</p>
        </OpsSection>
      ) : null}

      {message ? <p className="text-sm text-amber-200">{message}</p> : null}

      <OpsSection title="Stage 1 — A / B / C">
        <div className="space-y-3 rounded-2xl border border-white/8 p-5">
          <p className="text-xs text-slate-500">
            Watch the screener first. A escalates to Stage 2. B needs escalate. C needs tags. No reject.
          </p>
          <div className="flex gap-2">
            {(["A", "B", "C"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  group === g ? "bg-orange-500 text-slate-950" : "border border-white/12 text-slate-300"
                }`}
              >
                Group {g}
              </button>
            ))}
          </div>
          {group === "B" ? (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={escalateFlag} onChange={(e) => setEscalateFlag(e.target.checked)} />
              Escalate to Stage 2
            </label>
          ) : null}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma-separated) — required for C"
            className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            rows={3}
            className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => stage1.mutate()}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Save Stage 1
          </button>
        </div>
      </OpsSection>

      {data.canStage2 ? (
        <OpsSection title="Stage 2 — Official selection">
          <div className="space-y-3 rounded-2xl border border-white/8 p-5">
            <textarea
              value={overallThoughts}
              onChange={(e) => setOverallThoughts(e.target.value)}
              placeholder="Overall thoughts"
              rows={3}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={acceptReason}
              onChange={(e) => setAcceptReason(e.target.value)}
              placeholder="Why accept / select"
              rows={2}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Why not select"
              rows={2}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={craftNotes}
              onChange={(e) => setCraftNotes(e.target.value)}
              placeholder="Craft notes"
              rows={2}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="PENDING_APPROVAL">Pending approval</option>
              <option value="OFFICIAL_SELECTION">Official selection</option>
              <option value="NOT_SELECTED">Not selected</option>
            </select>
            <button
              type="button"
              onClick={() => stage2.mutate()}
              className="rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Save Stage 2
            </button>
          </div>
        </OpsSection>
      ) : null}
    </div>
  );
}
