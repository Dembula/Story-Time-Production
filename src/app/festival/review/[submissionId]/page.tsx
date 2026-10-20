"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function FestivalSubmissionReviewPage() {
  const params = useParams();
  const submissionId = String(params.submissionId);
  const qc = useQueryClient();
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
      setMessage("Stage 1 saved — status remains pending approval.");
      qc.invalidateQueries({ queryKey: ["festival-submission-review", submissionId] });
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
    },
    onError: (e: Error) => setMessage(e.message),
  });

  if (isLoading || !data?.submission) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const s = data.submission;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">{s.title}</h1>
        <p className="text-sm text-slate-400">
          {s.festival?.name} · {s.category?.name} · {s.selectionStatus?.replace(/_/g, " ")}
        </p>
      </div>

      {s.screenerUrl ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
          <video src={s.screenerUrl} controls className="aspect-video w-full" />
        </div>
      ) : (
        <p className="rounded-xl border border-slate-800 p-4 text-sm text-slate-500">No screener URL on this entry.</p>
      )}

      {s.logline ? <p className="text-sm italic text-slate-300">{s.logline}</p> : null}
      {s.synopsis ? <p className="whitespace-pre-wrap text-sm text-slate-400">{s.synopsis}</p> : null}

      {message ? <p className="text-sm text-amber-200">{message}</p> : null}

      <section className="space-y-3 rounded-2xl border border-slate-800 p-5">
        <h2 className="text-lg font-semibold text-white">Stage 1 — A / B / C</h2>
        <p className="text-xs text-slate-500">
          No reject button. A auto-escalates to Stage 2. B needs escalate flag. C requires tags.
        </p>
        <div className="flex gap-2">
          {(["A", "B", "C"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                group === g ? "bg-amber-500 text-slate-950" : "border border-slate-700 text-slate-300"
              }`}
            >
              Group {g}
            </button>
          ))}
        </div>
        {group === "B" ? (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={escalateFlag} onChange={(e) => setEscalateFlag(e.target.checked)} />
            Flag to escalate to Stage 2
          </label>
        ) : null}
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma-separated) — required for C"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={() => stage1.mutate()}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white"
        >
          Save Stage 1
        </button>
      </section>

      {data.canStage2 ? (
        <section className="space-y-3 rounded-2xl border border-slate-800 p-5">
          <h2 className="text-lg font-semibold text-white">Stage 2 — Selection form</h2>
          <textarea value={overallThoughts} onChange={(e) => setOverallThoughts(e.target.value)} placeholder="Overall thoughts" rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <textarea value={acceptReason} onChange={(e) => setAcceptReason(e.target.value)} placeholder="Why accept / select" rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Why not select" rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <textarea value={craftNotes} onChange={(e) => setCraftNotes(e.target.value)} placeholder="Craft notes" rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <select
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="OFFICIAL_SELECTION">Official selection</option>
            <option value="NOT_SELECTED">Not selected</option>
          </select>
          <button
            type="button"
            onClick={() => stage2.mutate()}
            className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Save Stage 2
          </button>
        </section>
      ) : null}
    </div>
  );
}
