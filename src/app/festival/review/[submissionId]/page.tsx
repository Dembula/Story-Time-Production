"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Film,
  RotateCcw,
  Star,
  StarOff,
} from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalScreenerPlayer } from "@/components/festival/festival-screener-player";

type FormPayload = {
  contact?: Record<string, unknown> | null;
  credits?: Record<string, unknown> | null;
  specifications?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 border-b border-white/[0.04] py-2.5 sm:grid-cols-[130px_1fr] last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function peopleLines(people: unknown): string {
  if (!Array.isArray(people)) return "";
  return people
    .map((p) => {
      const row = asRecord(p);
      if (!row) return "";
      const name = [str(row.firstName), str(row.middleName), str(row.lastName)].filter(Boolean).join(" ");
      const bits = [name, str(row.role), str(row.email)].filter(Boolean);
      return bits.join(" · ");
    })
    .filter(Boolean)
    .join("\n");
}

function StatusChip({
  tone,
  children,
}: {
  tone: "orange" | "emerald" | "slate" | "amber" | "cyan";
  children: ReactNode;
}) {
  const tones = {
    orange: "bg-orange-500/15 text-orange-100 ring-orange-400/30",
    emerald: "bg-emerald-500/15 text-emerald-100 ring-emerald-400/30",
    slate: "bg-white/[0.06] text-slate-300 ring-white/10",
    amber: "bg-amber-500/15 text-amber-100 ring-amber-400/30",
    cyan: "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

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

  useEffect(() => {
    const s = data?.submission;
    if (!s) return;
    if (s.stage1Group === "A" || s.stage1Group === "B" || s.stage1Group === "C") {
      setGroup(s.stage1Group);
    }
    if (typeof s.selectionStatus === "string") {
      setRecommendation(s.selectionStatus);
    }
    if (Array.isArray(s.tags) && s.tags.length) {
      setTags(s.tags.join(", "));
    }
  }, [data?.submission]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["festival-submission-review", submissionId] });
    qc.invalidateQueries({ queryKey: ["festival-submissions"] });
    qc.invalidateQueries({ queryKey: ["festival-submissions-all"] });
    qc.invalidateQueries({ queryKey: ["festival-screening"] });
  }

  const quick = useMutation({
    mutationFn: async (intent: string) => {
      const res = await fetch(`/api/festival/submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quick", intent }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      return json;
    },
    onSuccess: (_json, intent) => {
      const labels: Record<string, string> = {
        escalate: "Escalated to Stage 2.",
        deescalate: "Moved back to Stage 1.",
        rereview: "Reset for re-review from Stage 1.",
        official: "Added to Official Selection.",
        remove_official: "Removed from Official Selection.",
      };
      setMessage(labels[intent] || "Updated.");
      invalidateAll();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const stage1 = useMutation({
    mutationFn: async (alsoEscalate: boolean) => {
      const res = await fetch(`/api/festival/submissions/${submissionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "STAGE1",
          group,
          escalateFlag: alsoEscalate || escalateFlag || group === "A",
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: (_j, alsoEscalate) => {
      setMessage(alsoEscalate || group === "A" ? "Saved and escalated to Stage 2." : "Stage 1 saved.");
      invalidateAll();
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
      setMessage(
        recommendation === "OFFICIAL_SELECTION"
          ? "Saved — film is on Official Selection."
          : recommendation === "NOT_SELECTED"
            ? "Saved — film is not selected."
            : "Stage 2 notes saved.",
      );
      invalidateAll();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  if (isLoading || !data?.submission) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const s = data.submission;
  const activeUrl = watchTab === "trailer" ? s.trailerUrl : s.screenerUrl;
  const rootPayload = asRecord(s.formPayload) ?? {};
  const payload = rootPayload as FormPayload;
  const contact = asRecord(payload.contact);
  const credits = asRecord(payload.credits);
  const specs = asRecord(payload.specifications);
  const stillUrls: string[] = Array.isArray(s.stillUrls) ? s.stillUrls : [];
  const pressKitUrl = str(specs?.pressKitUrl);
  const screenerPassword = str(specs?.screenerPassword);
  const isOfficial = s.selectionStatus === "OFFICIAL_SELECTION";
  const isStage2 = s.reviewStage === "STAGE2";
  const canPlace = Boolean(data.canStage2 || data.canManage);
  const busy = quick.isPending || stage1.isPending || stage2.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <OpsPageHeader
        title={s.title}
        subtitle={`${s.festival?.name} · ${s.category?.name || "Entry"}`}
        actions={
          <Link
            href="/festival/review"
            className="rounded-xl border border-white/12 px-3 py-2 text-sm text-slate-300 hover:border-white/25"
          >
            Back to hub
          </Link>
        }
      />

      {/* Status ribbon */}
      <div
        className={`overflow-hidden rounded-3xl border p-5 ${
          isOfficial
            ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-black/40 to-black/20"
            : isStage2
              ? "border-orange-400/25 bg-gradient-to-br from-orange-500/12 via-black/40 to-black/20"
              : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Review status
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip tone={isStage2 ? "orange" : "cyan"}>
                {isStage2 ? "Stage 2" : "Stage 1"}
              </StatusChip>
              {s.stage1Group ? <StatusChip tone="slate">Group {s.stage1Group}</StatusChip> : null}
              <StatusChip tone={isOfficial ? "emerald" : s.selectionStatus === "NOT_SELECTED" ? "slate" : "amber"}>
                {isOfficial ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3" /> Official selection
                  </span>
                ) : (
                  String(s.selectionStatus || "").replace(/_/g, " ")
                )}
              </StatusChip>
              {s.escalateFlag ? <StatusChip tone="orange">Escalated</StatusChip> : null}
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Filmmaker: {s.creator?.name || s.creator?.email || "—"}
              {str(contact?.email) && str(contact?.email) !== s.creator?.email
                ? ` · Contact ${str(contact?.email)}`
                : ""}
              {str(contact?.phone) ? ` · ${str(contact?.phone)}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isStage2 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => quick.mutate("escalate")}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_28px_-8px_rgba(249,115,22,0.8)] hover:bg-orange-400 disabled:opacity-50"
              >
                <ArrowUp className="h-4 w-4" />
                Escalate to Stage 2
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !canPlace}
                onClick={() => quick.mutate("deescalate")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-orange-400/40 disabled:opacity-50"
              >
                <ArrowDown className="h-4 w-4" />
                De-escalate to Stage 1
              </button>
            )}

            {canPlace && !isOfficial ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => quick.mutate("official")}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                <Star className="h-4 w-4" />
                Add to Official Selection
              </button>
            ) : null}

            {canPlace && isOfficial ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => quick.mutate("remove_official")}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <StarOff className="h-4 w-4" />
                Remove from Official Selection
              </button>
            ) : null}

            {canPlace ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Reset this entry to Stage 1 ungrouped for a full re-review?")) {
                    quick.mutate("rereview");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-white/25 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Re-review
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {message ? (
        <p className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {message}
        </p>
      ) : null}

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
        {screenerPassword ? (
          <p className="mt-2 text-xs text-amber-200/90">Screener password: {screenerPassword}</p>
        ) : null}
      </OpsSection>

      {s.logline ? (
        <p className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm italic text-slate-300">
          {s.logline}
        </p>
      ) : null}

      {s.synopsis ? (
        <OpsSection title="Synopsis">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{s.synopsis}</p>
        </OpsSection>
      ) : null}

      <OpsSection title="Submitted entry details">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-orange-200">
              <Film className="h-4 w-4" /> Contact
            </h3>
            <dl>
              <DetailRow label="Name" value={str(contact?.name) || s.creator?.name} />
              <DetailRow label="Email" value={str(contact?.email) || s.creator?.email} />
              <DetailRow label="Phone" value={str(contact?.phone)} />
              <DetailRow label="Alt phone" value={str(contact?.altPhone)} />
              <DetailRow label="Company" value={str(contact?.company)} />
              <DetailRow label="Website" value={str(contact?.website)} />
              <DetailRow
                label="Address"
                value={[
                  str(contact?.street),
                  str(contact?.city),
                  str(contact?.province),
                  str(contact?.postalCode),
                  str(contact?.country),
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
            </dl>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
            <h3 className="mb-1 text-sm font-semibold text-orange-200">Credits</h3>
            <dl>
              <DetailRow label="Directors" value={peopleLines(credits?.directors)} />
              <DetailRow label="Producers" value={peopleLines(credits?.producers)} />
              <DetailRow label="Writers" value={peopleLines(credits?.writers)} />
              <DetailRow label="Production" value={str(credits?.productionCompany)} />
              <DetailRow label="Key cast" value={str(credits?.keyCast)} />
            </dl>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/25 p-4 lg:col-span-2">
            <h3 className="mb-1 text-sm font-semibold text-orange-200">Specifications</h3>
            <dl className="sm:columns-2 sm:gap-8">
              <DetailRow
                label="Types"
                value={
                  Array.isArray(specs?.projectTypes)
                    ? (specs?.projectTypes as unknown[]).map(str).filter(Boolean).join(", ")
                    : str(specs?.projectTypes)
                }
              />
              <DetailRow
                label="Genres"
                value={
                  Array.isArray(specs?.genres)
                    ? (specs?.genres as unknown[]).map(str).filter(Boolean).join(", ")
                    : str(specs?.genres)
                }
              />
              <DetailRow
                label="Runtime"
                value={
                  specs?.runtimeMinutes != null && str(specs.runtimeMinutes)
                    ? `${str(specs.runtimeMinutes)} min`
                    : ""
                }
              />
              <DetailRow label="Year" value={str(specs?.productionYear)} />
              <DetailRow label="Language" value={str(specs?.originalLanguage)} />
              <DetailRow label="Subtitles" value={str(specs?.subtitleLanguages)} />
              <DetailRow label="Origin" value={str(specs?.countryOfOrigin)} />
              <DetailRow label="Premiere" value={str(specs?.premiereStatus)} />
              <DetailRow label="Aspect" value={str(specs?.aspectRatio)} />
              <DetailRow
                label="Frame rate"
                value={str(specs?.frameRate) ? `${str(specs?.frameRate)} fps` : ""}
              />
              <DetailRow label="Sound" value={str(specs?.soundMix)} />
              <DetailRow label="Colour" value={str(specs?.colourBw)} />
              <DetailRow label="Camera" value={str(specs?.shootingFormat)} />
              <DetailRow label="Warnings" value={str(specs?.contentWarnings)} />
            </dl>
          </div>
        </div>

        {(stillUrls.length > 0 || pressKitUrl) && (
          <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-orange-200">Stills & press</h3>
            {stillUrls.length > 0 ? (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stillUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-xl border border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="aspect-video w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
            {pressKitUrl ? (
              <a
                href={pressKitUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-orange-200 hover:text-orange-100"
              >
                Open press kit
              </a>
            ) : null}
          </div>
        )}
      </OpsSection>

      {/* Stage 1 */}
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-white">Stage 1 — Group & escalate</h2>
          <p className="mt-1 text-sm text-slate-400">
            A moves up automatically. B can escalate. C needs tags. Use the orange Escalate button above for a one-click push to Stage 2.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {(["A", "B", "C"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={`min-w-[5.5rem] rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  group === g
                    ? g === "A"
                      ? "bg-emerald-500 text-slate-950"
                      : g === "B"
                        ? "bg-orange-500 text-slate-950"
                        : "bg-violet-500 text-white"
                    : "border border-white/12 text-slate-300 hover:border-white/25"
                }`}
              >
                Group {g}
              </button>
            ))}
          </div>
          {group === "B" ? (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={escalateFlag} onChange={(e) => setEscalateFlag(e.target.checked)} />
              Escalate this B to Stage 2 when saving
            </label>
          ) : null}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma-separated) — required for C"
            className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-sm text-white"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for programmers"
            rows={3}
            className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-sm text-white"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => stage1.mutate(false)}
              className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white hover:border-white/25 disabled:opacity-50"
            >
              Save Stage 1
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => stage1.mutate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
              Save & escalate
            </button>
          </div>
        </div>
      </section>

      {/* Stage 2 */}
      {data.canStage2 ? (
        <section
          className={`overflow-hidden rounded-3xl border ${
            isOfficial
              ? "border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent"
              : "border-white/10 bg-gradient-to-b from-orange-500/[0.06] to-transparent"
          }`}
        >
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">Stage 2 — Official selection</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Decide selection, or use the ribbon buttons to add/remove Official Selection instantly.
                </p>
              </div>
              {isOfficial ? (
                <StatusChip tone="emerald">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> On official selection
                  </span>
                </StatusChip>
              ) : null}
            </div>
          </div>
          <div className="space-y-3 p-5">
            <textarea
              value={overallThoughts}
              onChange={(e) => setOverallThoughts(e.target.value)}
              placeholder="Overall thoughts"
              rows={3}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
            <textarea
              value={acceptReason}
              onChange={(e) => setAcceptReason(e.target.value)}
              placeholder="Why accept / select"
              rows={2}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Why not select"
              rows={2}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
            <textarea
              value={craftNotes}
              onChange={(e) => setCraftNotes(e.target.value)}
              placeholder="Craft notes"
              rows={2}
              className="w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-sm text-white"
            />
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Selection decision
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2.5 text-sm font-medium text-white"
              >
                <option value="PENDING_APPROVAL">Pending approval</option>
                <option value="OFFICIAL_SELECTION">Official selection</option>
                <option value="NOT_SELECTED">Not selected</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => stage2.mutate()}
                className="rounded-xl bg-orange-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
              >
                Save Stage 2
              </button>
              {isOfficial ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => quick.mutate("remove_official")}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/35 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  <StarOff className="h-4 w-4" />
                  Take off Official Selection
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setRecommendation("OFFICIAL_SELECTION");
                    quick.mutate("official");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Star className="h-4 w-4" />
                  Put on Official Selection
                </button>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
