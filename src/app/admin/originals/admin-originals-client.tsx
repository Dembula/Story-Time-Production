"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatZar } from "@/lib/format-currency-zar";
import {
  Sparkles,
  Film,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Send,
  FileText,
  DollarSign,
  Eye,
  Clapperboard,
  Lightbulb,
  Users,
  ExternalLink,
  Mail,
  User,
} from "lucide-react";

// Creator-submitted Originals request (full pitch package)
interface Pitch {
  id: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  type: string;
  genre: string | null;
  scriptUrl: string | null;
  scriptProjectId: string | null;
  scriptId: string | null;
  treatmentUrl: string | null;
  lookbookUrl: string | null;
  budgetEst: number | null;
  targetAudience: string | null;
  references: string | null;
  directorStatement: string | null;
  productionCompany: string | null;
  previousWorkSummary: string | null;
  intendedRelease: string | null;
  keyCastCrew: string | null;
  financingStatus: string | null;
  status: string;
  adminNote: string | null;
  reviewReasonCodes: string | null;
  reviewWeightedScore: number | null;
  reviewRubric: {
    story?: number;
    marketability?: number;
    feasibility?: number;
    teamReadiness?: number;
    weightedScore?: number;
  } | null;
  submissionTimeline: Array<{
    type: string;
    at: string;
    status?: string;
    note?: string;
    reasonCodes?: string[];
    weightedScore?: number;
  }> | null;
  resubmissionCount: number;
  createdAt: string;
  creator: { id: string; name: string | null; email: string | null };
  project: { id: string; title: string } | null;
}

// Creator-submitted movie idea (standalone, not yet an Original)
interface Idea {
  id: string;
  title: string;
  logline: string | null;
  notes: string | null;
  genres: string | null;
  moodboardUrls: string | null;
  createdAt: string;
  convertedToProject: boolean;
  user: { id: string; name: string | null; email: string | null } | null;
}

// Greenlit Original (project linked to creator)
interface OriginalsProject {
  id: string;
  title: string;
  logline: string | null;
  status: string;
  phase: string;
  members: { id: string; role: string; user: { id: string; name: string | null; email: string | null } }[];
}

const PITCH_STATUS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  DECLINED: "Declined",
};

const REVIEW_REASON_CODES = [
  { code: "STORY_CLARITY", label: "Story clarity issues" },
  { code: "CHARACTER_DEPTH", label: "Character depth is weak" },
  { code: "MARKET_POSITIONING", label: "Market positioning unclear" },
  { code: "AUDIENCE_FIT", label: "Audience fit concerns" },
  { code: "BUDGET_REALISM", label: "Budget realism concerns" },
  { code: "PRODUCTION_FEASIBILITY", label: "Production feasibility risk" },
  { code: "TEAM_EXPERIENCE", label: "Team readiness/experience gap" },
  { code: "PACKAGE_INCOMPLETE", label: "Submission package incomplete" },
  { code: "LEGAL_RIGHTS_UNCLEAR", label: "Rights/legal unclear" },
  { code: "BRAND_SAFETY_CONCERNS", label: "Brand safety concerns" },
] as const;

const PITCH_STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  CHANGES_REQUESTED: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  DECLINED: "bg-red-500/10 text-red-400 border-red-500/30",
};

export function AdminOriginalsClient() {
  const [tab, setTab] = useState<"inbox" | "ideas" | "originals">("inbox");
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<OriginalsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rubric, setRubric] = useState({ story: 7, marketability: 7, feasibility: 7, teamReadiness: 7 });
  const [reasonCodes, setReasonCodes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    Promise.all([
      fetch("/api/originals?type=pitches").then((r) => r.json()),
      fetch("/api/originals?type=standalone-ideas").then((r) => r.json()),
      fetch("/api/originals?type=projects").then((r) => r.json()),
    ])
      .then(([p, i, proj]) => {
        setPitches(Array.isArray(p) ? p : []);
        setIdeas(Array.isArray(i) ? i : []);
        setProjects(Array.isArray(proj) ? proj : []);
      })
      .catch(() => {
        setPitches([]);
        setIdeas([]);
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function reviewPitch(pitchId: string, status: string) {
    if ((status === "DECLINED" || status === "CHANGES_REQUESTED") && reasonCodes.length === 0) {
      window.alert("Select at least one reason code for Decline or Changes Requested.");
      return;
    }
    setActionLoading(pitchId);
    try {
      const res = await fetch("/api/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVIEW_PITCH", pitchId, status, adminNote: reviewNote, rubric, reasonCodes }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Pitch;
        setPitches((prev) => prev.map((p) => (p.id === pitchId ? { ...p, ...updated } : p)));
        setReviewNote("");
        setReasonCodes([]);
        if (status === "APPROVED" && updated.project) {
          const approvedProject = updated.project;
          setProjects((prev) => {
            const exists = prev.some((x) => x.id === approvedProject.id);
            if (exists) return prev.map((x) => (x.id === approvedProject.id ? { ...x, ...approvedProject } : x));
            return [
              {
                id: approvedProject.id,
                title: approvedProject.title,
                logline: updated.logline,
                status: "DEVELOPMENT",
                phase: "CONCEPT",
                members: [],
              },
              ...prev,
            ];
          });
        }
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function promoteIdea(ideaId: string) {
    setActionLoading(ideaId);
    try {
      const res = await fetch("/api/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PROMOTE_IDEA", ideaId }),
      });
      if (res.ok) {
        const { projectId } = (await res.json()) as { projectId: string };
        setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
        const refreshed = await fetch("/api/originals?type=projects").then((r) => r.json());
        setProjects(Array.isArray(refreshed) ? refreshed : projects);
        window.open(`/creator/projects/${projectId}/workspace`, "_blank");
      }
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCount = pitches.filter((p) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(p.status)).length;
  const approvedCount = pitches.filter((p) => p.status === "APPROVED").length;
  const creatorIds = new Set([
    ...pitches.map((p) => p.creator.id),
    ...ideas.map((i) => i.user?.id).filter(Boolean) as string[],
  ]);
  const filteredPitches = pitches.filter((p) => {
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      (p.logline ?? "").toLowerCase().includes(q) ||
      (p.creator.name ?? "").toLowerCase().includes(q) ||
      (p.creator.email ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });
  const weightedScorePreview = Math.round((rubric.story * 0.4 + rubric.marketability * 0.25 + rubric.feasibility * 0.2 + rubric.teamReadiness * 0.15) * 10 * 10) / 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-slate-700/60 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-orange-500" />
              Originals Collaboration Portal
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              All content here comes from <strong className="text-slate-300">creators only</strong>: Originals requests (full pitch + script) and movie ideas from their vault. Review requests, promote ideas to Originals, and open the shared workspace to collaborate with the creator on each film.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Pending requests</p>
            <p className="text-2xl font-bold text-amber-400 mt-0.5">{pendingCount}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Movie ideas (vault)</p>
            <p className="text-2xl font-bold text-white mt-0.5">{ideas.length}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Approved / Active</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{projects.length}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Approved submissions</p>
            <p className="text-2xl font-bold text-emerald-300 mt-0.5">{approvedCount}</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Creators engaged</p>
            <p className="text-2xl font-bold text-orange-400 mt-0.5">{creatorIds.size}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mt-6">
          <button
            onClick={() => setTab("inbox")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === "inbox"
                ? "bg-orange-500 text-white"
                : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
            }`}
          >
            Originals requests ({pitches.length})
          </button>
          <button
            onClick={() => setTab("ideas")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === "ideas"
                ? "bg-orange-500 text-white"
                : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
            }`}
          >
            Movie ideas ({ideas.length})
          </button>
          <button
            onClick={() => setTab("originals")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === "originals"
                ? "bg-orange-500 text-white"
                : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50"
            }`}
          >
            Active Originals ({projects.length})
          </button>
        </div>
      </div>

      {/* Tab: Originals requests (creator pitches) */}
      {tab === "inbox" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-orange-400" />
            Full submissions from creators via <strong className="text-slate-400">Creator → Originals → Submit an Original</strong>. Each includes script (link or platform script), synopsis, and full package. Approve to create a shared Original and link the creator to the collaboration workspace.
          </p>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 flex flex-wrap gap-3 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, creator, email, or logline..."
              className="min-w-[260px] flex-1 px-3 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-sm text-white"
            >
              <option value="ALL">All statuses</option>
              {Object.keys(PITCH_STATUS).map((status) => (
                <option key={status} value={status}>{PITCH_STATUS[status]}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">{filteredPitches.length} result(s)</span>
          </div>
          {filteredPitches.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
              <Clapperboard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No Originals requests yet.</p>
              <p className="text-slate-500 text-sm mt-1">When creators submit an Original, they will appear here.</p>
            </div>
          ) : (
            filteredPitches.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
                <button
                  type="button"
                  className="w-full p-5 text-left hover:bg-slate-800/60 transition flex flex-wrap items-center justify-between gap-3"
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                      <Clapperboard className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${PITCH_STATUS_STYLE[p.status] ?? "bg-slate-500/10 text-slate-400"}`}>
                          {PITCH_STATUS[p.status] ?? p.status}
                        </span>
                        {p.type && <span className="text-xs text-slate-500">{p.type}{p.genre ? ` · ${p.genre}` : ""}</span>}
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">{p.logline}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {p.creator.name ?? "Creator"}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {p.creator.email}</span>
                        <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {expanded === p.id ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                </button>

                {expanded === p.id && (
                  <div className="border-t border-slate-700/50 p-6 bg-slate-900/40 space-y-6">
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                      <h4 className="text-sm font-semibold text-white mb-3">Submission completeness checklist</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {([
                          ["Script", !!(p.scriptUrl || p.scriptId || p.scriptProjectId)],
                          ["Synopsis", !!p.synopsis],
                          ["Genre", !!p.genre],
                          ["Target audience", !!p.targetAudience],
                          ["References", !!p.references],
                          ["Director statement", !!p.directorStatement],
                          ["Production company", !!p.productionCompany],
                          ["Previous work", !!p.previousWorkSummary],
                          ["Intended release", !!p.intendedRelease],
                          ["Key cast/crew", !!p.keyCastCrew],
                          ["Financing status", !!p.financingStatus],
                          ["Budget estimate", p.budgetEst != null && Number(p.budgetEst) > 0],
                        ] as Array<[string, boolean]>).map(([label, ok]) => (
                          <div key={label} className={`rounded-md px-2 py-1 border ${ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                            {ok ? "Complete" : "Missing"} - {label}
                          </div>
                        ))}
                      </div>
                    </div>
                    {p.synopsis && (
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-2">Synopsis</h4>
                        <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{p.synopsis}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {p.budgetEst != null && (
                        <div><span className="text-slate-500">Est. budget:</span> <span className="text-orange-400">{formatZar(Number(p.budgetEst), { maximumFractionDigits: 0 })}</span></div>
                      )}
                      {p.targetAudience && <div><span className="text-slate-500">Target audience:</span> <span className="text-slate-300">{p.targetAudience}</span></div>}
                      {p.references && <div className="md:col-span-2"><span className="text-slate-500">References:</span> <span className="text-slate-300">{p.references}</span></div>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {(p.scriptId || p.scriptProjectId) && (
                        <span className="text-emerald-400">Script attached from Pre-Production</span>
                      )}
                      {[{ label: "Script", url: p.scriptUrl }, { label: "Treatment", url: p.treatmentUrl }, { label: "Lookbook", url: p.lookbookUrl }].map(({ label, url }) => (
                        <span key={label} className={url ? "text-orange-400" : "text-slate-600"}>
                          <FileText className="w-3 h-3 inline mr-1" />{label}: {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline">View</a> : "—"}
                        </span>
                      ))}
                    </div>
                    {p.directorStatement && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 mb-1">Director statement</h4>
                        <p className="text-sm text-slate-400">{p.directorStatement}</p>
                      </div>
                    )}
                    {(p.productionCompany || p.previousWorkSummary) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {p.productionCompany && <div><span className="text-slate-500">Production company:</span> <span className="text-slate-300">{p.productionCompany}</span></div>}
                        {p.previousWorkSummary && <div className="md:col-span-2"><span className="text-slate-500">Previous work:</span> <p className="text-slate-300 mt-0.5">{p.previousWorkSummary}</p></div>}
                      </div>
                    )}
                    {(p.intendedRelease || p.keyCastCrew || p.financingStatus) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {p.intendedRelease && <div><span className="text-slate-500">Intended release:</span> <span className="text-slate-300">{p.intendedRelease}</span></div>}
                        {p.financingStatus && <div><span className="text-slate-500">Financing:</span> <span className="text-slate-300">{p.financingStatus}</span></div>}
                        {p.keyCastCrew && <div className="md:col-span-2"><span className="text-slate-500">Key cast/crew:</span> <p className="text-slate-300 mt-0.5">{p.keyCastCrew}</p></div>}
                      </div>
                    )}
                    {p.adminNote && (
                      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                        <p className="text-xs font-semibold text-orange-400">Admin note (visible to creator)</p>
                        <p className="text-sm text-slate-400 mt-0.5">{p.adminNote}</p>
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-white">Admin scoring rubric</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          ["story", "Story (40%)"],
                          ["marketability", "Marketability (25%)"],
                          ["feasibility", "Feasibility (20%)"],
                          ["teamReadiness", "Team readiness (15%)"],
                        ].map(([key, label]) => (
                          <label key={key} className="text-xs text-slate-400">
                            {label}
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={rubric[key as keyof typeof rubric]}
                              onChange={(e) =>
                                setRubric((prev) => ({
                                  ...prev,
                                  [key]: Math.max(0, Math.min(10, Number(e.target.value || 0))),
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 bg-slate-900/70 border border-slate-600 rounded-lg text-sm text-white"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="text-sm text-slate-300">
                        Weighted score preview: <span className="text-orange-400 font-medium">{weightedScorePreview}/100</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-white">Reason codes (required for Decline / Changes Requested)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {REVIEW_REASON_CODES.map((reason) => (
                          <label key={reason.code} className="text-xs text-slate-300 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={reasonCodes.includes(reason.code)}
                              onChange={(e) => {
                                setReasonCodes((prev) =>
                                  e.target.checked
                                    ? [...prev, reason.code]
                                    : prev.filter((c) => c !== reason.code),
                                );
                              }}
                            />
                            {reason.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    {(p.submissionTimeline?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-white">Resubmission & review timeline</h4>
                        <div className="space-y-2">
                          {(p.submissionTimeline ?? []).map((event, idx) => (
                            <div key={`${event.type}-${event.at}-${idx}`} className="text-xs border border-slate-700/60 rounded-md p-2 bg-slate-900/50">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-orange-400 font-medium">{event.type}</span>
                                <span className="text-slate-500">{new Date(event.at).toLocaleString()}</span>
                                {event.status && <span className="text-slate-300">status: {event.status}</span>}
                                {typeof event.weightedScore === "number" && (
                                  <span className="text-emerald-300">score: {event.weightedScore}/100</span>
                                )}
                              </div>
                              {event.note && <p className="text-slate-400 mt-1">{event.note}</p>}
                              {Array.isArray(event.reasonCodes) && event.reasonCodes.length > 0 && (
                                <p className="text-slate-400 mt-1">codes: {event.reasonCodes.join(", ")}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">Total resubmissions: {p.resubmissionCount ?? 0}</p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-700/50 space-y-3">
                      <label className="block text-xs font-medium text-slate-400">Add or update feedback for creator</label>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Admin feedback (optional)..."
                        rows={2}
                        className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20"
                      />
                      <div className="flex flex-wrap gap-2">
                        {p.status !== "APPROVED" && (
                          <button
                            onClick={() => reviewPitch(p.id, "APPROVED")}
                            disabled={actionLoading === p.id}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-sm font-medium disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                        )}
                        {p.status !== "UNDER_REVIEW" && (
                          <button
                            onClick={() => reviewPitch(p.id, "UNDER_REVIEW")}
                            disabled={actionLoading === p.id}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-sm font-medium disabled:opacity-50"
                          >
                            <Eye className="w-4 h-4" /> Mark under review
                          </button>
                        )}
                        {p.status !== "CHANGES_REQUESTED" && (
                          <button
                            onClick={() => reviewPitch(p.id, "CHANGES_REQUESTED")}
                            disabled={actionLoading === p.id}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 text-sm font-medium disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" /> Request changes
                          </button>
                        )}
                        {p.status !== "DECLINED" && (
                          <button
                            onClick={() => reviewPitch(p.id, "DECLINED")}
                            disabled={actionLoading === p.id}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 text-sm font-medium disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Decline
                          </button>
                        )}
                      </div>
                    </div>

                    {p.status === "APPROVED" && p.project && (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                        <p className="text-xs text-slate-400">This request is linked to an Original. Open the shared workspace to collaborate with the creator.</p>
                        <Link
                          href={`/creator/projects/${p.project.id}/workspace`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 text-sm font-medium hover:bg-orange-500/20"
                        >
                          <ExternalLink className="w-4 h-4" /> Open collaboration workspace
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Movie ideas (creator vault) */}
      {tab === "ideas" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            Standalone movie ideas saved by creators in their idea vault (not yet tied to a project). Promote a promising idea to create an Original and link that creator to the shared workspace.
          </p>
          {ideas.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
              <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No standalone movie ideas yet.</p>
              <p className="text-slate-500 text-sm mt-1">As creators add ideas to their vault, they will appear here for potential development into Originals.</p>
            </div>
          ) : (
            ideas.map((idea) => (
              <div key={idea.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 overflow-hidden">
                <button
                  type="button"
                  className="w-full p-5 text-left hover:bg-slate-800/60 transition flex flex-wrap items-center justify-between gap-3"
                  onClick={() => setExpanded(expanded === idea.id ? null : idea.id)}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">{idea.title}</h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600">Idea vault</span>
                        {idea.genres && <span className="text-xs text-slate-500">{idea.genres}</span>}
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">{idea.logline || idea.notes || "No logline yet."}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {idea.user?.name ?? "Creator"}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {idea.user?.email ?? "—"}</span>
                        <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {expanded === idea.id ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                </button>

                {expanded === idea.id && (
                  <div className="border-t border-slate-700/50 p-6 bg-slate-900/40 space-y-4">
                    {idea.notes && (
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-2">Notes / worldbuilding</h4>
                        <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{idea.notes}</p>
                      </div>
                    )}
                    {idea.moodboardUrls && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 mb-1">Moodboard links</h4>
                        <p className="text-xs text-slate-300 break-words">{idea.moodboardUrls}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 max-w-md">
                        Promote this idea to an Original to create a shared project workspace. The creator will see it in their Projects dashboard with an <strong className="text-orange-400">Original</strong> badge.
                      </p>
                      <button
                        onClick={() => promoteIdea(idea.id)}
                        disabled={actionLoading === idea.id}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                      >
                        <Film className="w-4 h-4" />
                        Create Original from idea
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Active Originals (linked creator + project) */}
      {tab === "originals" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Greenlit Originals: each is linked to the creator and has a shared pre-/production/post workspace. Open the workspace to collaborate in depth.
          </p>
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
              <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No Active Originals yet.</p>
              <p className="text-slate-500 text-sm mt-1">Approve an Originals request or promote a movie idea to create one.</p>
            </div>
          ) : (
            projects.map((proj) => (
              <div key={proj.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white">{proj.title}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300">{proj.status.replace(/_/g, " ")}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full border border-slate-600 text-slate-400">{proj.phase.replace(/_/g, " ")}</span>
                  </div>
                  {proj.logline && <p className="text-sm text-slate-400 line-clamp-2">{proj.logline}</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                    {proj.members.slice(0, 5).map((m) => (
                      <span key={m.id} className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {m.user.name ?? "Member"} · {m.role}
                      </span>
                    ))}
                    {proj.members.length > 5 && <span>+{proj.members.length - 5} more</span>}
                  </div>
                </div>
                <Link
                  href={`/creator/projects/${proj.id}/workspace`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 text-sm font-medium hover:bg-orange-500/20 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" /> Open collaboration workspace
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
