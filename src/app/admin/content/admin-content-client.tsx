"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, Clock, Eye, AlertTriangle, Film, Star,
  MessageSquare, Users, ChevronDown, ChevronUp, Send, Shield,
  Sparkles, Globe, Tag, Calendar, EyeOff, Play, Search, ExternalLink,
} from "lucide-react";
import {
  REVIEW_CTA_PRESET_TEMPLATES,
  resolveCtaPresetPath,
  parseReviewFeedback,
  type ReviewFeedbackKind,
} from "@/lib/review-feedback";

interface ContentItem {
  id: string;
  title: string;
  type: string;
  description: string | null;
  posterUrl: string | null;
  videoUrl: string | null;
  trailerUrl: string | null;
  category: string | null;
  tags: string | null;
  language: string | null;
  country: string | null;
  ageRating: string | null;
  year: number | null;
  duration: number | null;
  episodes: number | null;
  published: boolean;
  featured: boolean;
  reviewStatus: string;
  reviewNote: string | null;
  reviewFeedback?: unknown;
  linkedProjectId?: string | null;
  linkedProject?: { id: string; title: string } | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  creator: { id: string; name: string | null; email: string | null; isAfdaStudent: boolean };
  _count: { watchSessions: number; ratings: number; comments: number; crewMembers: number };
  crewMembers: { name: string; role: string }[];
}

type FeedbackDraftRow = { kind: ReviewFeedbackKind; message: string; presetPath: string };

function AdminPipelineDigest({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-project-digest", projectId],
    queryFn: () => fetch(`/api/admin/projects/${projectId}/digest`).then((r) => r.json()),
  });
  if (isLoading) {
    return <p className="text-xs text-slate-500">Loading pipeline…</p>;
  }
  if (!data?.project) return null;
  const tp = (data.toolProgress ?? []) as { toolId: string; status: string; percent: number }[];
  const complete = tp.filter((t) => t.status === "COMPLETE").length;
  const lc = (data.linkedContent ?? []) as { id: string; title: string; reviewStatus: string }[];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
      <p className="text-xs font-medium text-orange-300/90">Linked project pipeline</p>
      <p className="text-[11px] text-slate-400">
        {data.project.title} · {complete}/{tp.length || 0} tools marked complete (snapshot)
      </p>
      {lc.length > 0 && (
        <div className="text-[11px] text-slate-500">
          <span className="text-slate-400">Catalogue linked: </span>
          {lc.map((x) => (
            <span key={x.id} className="mr-2">
              {x.title} ({x.reviewStatus})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_TABS = [
  { value: "ALL", label: "All", icon: Film },
  { value: "PENDING", label: "Pending", icon: Clock },
  { value: "APPROVED", label: "Published", icon: CheckCircle },
  { value: "REJECTED", label: "Rejected", icon: XCircle },
  { value: "CHANGES_REQUESTED", label: "Changes Req.", icon: AlertTriangle },
  { value: "DRAFT", label: "Drafts", icon: EyeOff },
];

function statusBadge(status: string) {
  const m: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Draft" },
    PENDING: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Pending" },
    APPROVED: { bg: "bg-green-500/10", text: "text-green-400", label: "Published" },
    REJECTED: { bg: "bg-red-500/10", text: "text-red-400", label: "Rejected" },
    CHANGES_REQUESTED: { bg: "bg-orange-500/10", text: "text-orange-400", label: "Changes Req." },
    UNPUBLISHED: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Unpublished" },
  };
  const s = m[status] || m.DRAFT;
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
}

export function AdminContentClient() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [feedbackById, setFeedbackById] = useState<Record<string, FeedbackDraftRow[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/content?status=${tab}`)
      .then((r) => r.json())
      .then(setContent)
      .finally(() => setLoading(false));
  }, [tab]);

  function ensureDraftsFor(c: ContentItem) {
    setNoteById((prev) =>
      prev[c.id] !== undefined ? prev : { ...prev, [c.id]: c.reviewNote || "" },
    );
    setFeedbackById((prev) => {
      if (prev[c.id] !== undefined) return prev;
      const parsed = parseReviewFeedback(c.reviewFeedback);
      const rows: FeedbackDraftRow[] = parsed.map((p) => {
        const preset =
          REVIEW_CTA_PRESET_TEMPLATES.find(
            (t) => resolveCtaPresetPath(t.path, c.linkedProject?.id ?? null) === p.ctaPath,
          )?.path ?? "";
        return {
          kind: p.kind,
          message: p.message,
          presetPath: preset,
        };
      });
      return { ...prev, [c.id]: rows };
    });
  }

  async function handleReview(contentId: string, action: string, featured?: boolean) {
    setActionLoading(contentId);
    const item = content.find((x) => x.id === contentId);
    const note = noteById[contentId] ?? "";
    const rows = feedbackById[contentId] ?? [];
    const linkedId = item?.linkedProject?.id ?? item?.linkedProjectId ?? null;
    const withCta = rows
      .filter((r) => r.message.trim())
      .map((r) => {
        const path = r.presetPath ? resolveCtaPresetPath(r.presetPath, linkedId) : null;
        const label = REVIEW_CTA_PRESET_TEMPLATES.find((t) => t.path === r.presetPath)?.label;
        return {
          kind: r.kind,
          message: r.message.trim(),
          ...(path ? { ctaPath: path, ...(label ? { ctaLabel: label } : {}) } : {}),
        };
      });

    const res = await fetch("/api/admin/content/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId,
        action,
        reviewNote: note,
        featured,
        ...(action === "REJECT" || action === "REQUEST_CHANGES" ? { reviewFeedback: withCta } : {}),
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setContent((prev) => prev.map((c) => (c.id === contentId ? { ...c, ...updated } : c)));
      setNoteById((prev) => ({ ...prev, [contentId]: "" }));
      setFeedbackById((prev) => ({ ...prev, [contentId]: [] }));
    }
    setActionLoading(null);
  }

  const filtered = content.filter((c) =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.creator.name?.toLowerCase().includes(search.toLowerCase())
  );

  const pending = content.filter((c) => c.reviewStatus === "PENDING").length;
  const published = content.filter((c) => c.reviewStatus === "APPROVED").length;
  const totalViews = content.reduce((s, c) => s + c._count.watchSessions, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-8 md:py-8">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
          Catalogue &amp; rights
        </p>
        <h1 className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          <Shield className="h-8 w-8 text-orange-500" /> Content vetting
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          General catalogue submissions (films, series, podcasts). Structured feedback and notifications go to the
          creator. <strong className="text-slate-300">Story Time Original</strong> pitch packages live under{" "}
          <Link href="/admin/originals" className="text-orange-400 hover:text-orange-300">
            Originals
          </Link>
          .
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Pending Review", value: pending, icon: Clock, color: "text-yellow-400" },
          { label: "Published", value: published, icon: CheckCircle, color: "text-green-400" },
          { label: "Total Content", value: content.length, icon: Film, color: "text-blue-400" },
          { label: "Total Views", value: totalViews.toLocaleString(), icon: Eye, color: "text-cyan-400" },
          { label: "Total Crew", value: content.reduce((s, c) => s + c._count.crewMembers, 0), icon: Users, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-slate-400">{s.label}</span></div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <button key={t.value} onClick={() => setTab(t.value)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${tab === t.value ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or creator..." className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
        </div>
      </div>

      {/* Video Preview Modal */}
      {previewing && (() => {
        const c = content.find((x) => x.id === previewing);
        if (!c) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewing(null)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">{c.title}</h3>
                  <p className="text-xs text-slate-400">{c.type} · by {c.creator.name} · {c.duration ? `${c.duration} min` : "Duration unknown"}</p>
                </div>
                <button onClick={() => setPreviewing(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="aspect-video bg-black">
                {c.videoUrl ? (
                  <video src={c.videoUrl} controls autoPlay className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">No video URL provided</div>
                )}
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-400">{c.description}</p>
                <div className="flex gap-3">
                  <button onClick={() => { handleReview(c.id, "APPROVE"); setPreviewing(null); }} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/20 transition">
                    <CheckCircle className="w-4 h-4" /> Approve & Publish
                  </button>
                  <button onClick={() => { handleReview(c.id, "REJECT"); setPreviewing(null); }} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center"><Film className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No content found.</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div
                className="p-5 cursor-pointer hover:bg-slate-800/70 transition"
                onClick={() => {
                  if (expanded === c.id) setExpanded(null);
                  else {
                    ensureDraftsFor(c);
                    setExpanded(c.id);
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  {c.posterUrl && <img src={c.posterUrl} alt="" className="w-12 h-18 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-white font-semibold">{c.title}</h3>
                      {statusBadge(c.reviewStatus)}
                      {c.featured && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400"><Star className="w-3 h-3 inline" /> Featured</span>}
                      {c.creator.isAfdaStudent && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Student</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>{c.type}</span>
                      <span>by {c.creator.name || c.creator.email}</span>
                      {c.language && <span>{c.language}</span>}
                      {c.duration && <span>{c.duration}min</span>}
                      {c.ageRating && <span className="px-1.5 py-0.5 rounded bg-slate-700/50">{c.ageRating}</span>}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{c._count.watchSessions}</span>
                      <span className="flex items-center gap-1"><Star className="w-3 h-3" />{c._count.ratings}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{c._count.comments}</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c._count.crewMembers} crew</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.videoUrl && (
                      <button onClick={(e) => { e.stopPropagation(); setPreviewing(c.id); }} className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition" title="Preview video">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {expanded === c.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
              </div>

              {expanded === c.id && (
                <div className="border-t border-slate-700/50 p-5 space-y-5 bg-slate-900/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-slate-300">Synopsis</h4>
                      <p className="text-sm text-slate-400 leading-relaxed">{c.description || "No synopsis provided."}</p>

                      <h4 className="text-sm font-medium text-slate-300 mt-4">Metadata</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-slate-500">Category:</span> <span className="text-slate-300">{c.category || "—"}</span></div>
                        <div><span className="text-slate-500">Tags:</span> <span className="text-slate-300">{c.tags || "—"}</span></div>
                        <div><span className="text-slate-500">Country:</span> <span className="text-slate-300">{c.country || "—"}</span></div>
                        <div><span className="text-slate-500">Language:</span> <span className="text-slate-300">{c.language || "—"}</span></div>
                        <div><span className="text-slate-500">Age Rating:</span> <span className="text-slate-300">{c.ageRating || "—"}</span></div>
                        <div><span className="text-slate-500">Year:</span> <span className="text-slate-300">{c.year || "—"}</span></div>
                        <div><span className="text-slate-500">Duration:</span> <span className="text-slate-300">{c.duration ? `${c.duration} min` : "—"}</span></div>
                        {c.episodes && <div><span className="text-slate-500">Episodes:</span> <span className="text-slate-300">{c.episodes}</span></div>}
                        <div><span className="text-slate-500">Submitted:</span> <span className="text-slate-300">{c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : "—"}</span></div>
                        <div><span className="text-slate-500">Reviewed:</span> <span className="text-slate-300">{c.reviewedAt ? new Date(c.reviewedAt).toLocaleDateString() : "—"}</span></div>
                        <div className="md:col-span-2">
                          <span className="text-slate-500">Linked project: </span>
                          {c.linkedProject ? (
                            <Link
                              href={`/admin/projects#${c.linkedProject.id}`}
                              className="text-orange-400 hover:text-orange-300"
                            >
                              {c.linkedProject.title}
                            </Link>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
                      </div>

                      {c.linkedProject?.id && <AdminPipelineDigest projectId={c.linkedProject.id} />}

                      {c.crewMembers.length > 0 && (
                        <><h4 className="text-sm font-medium text-slate-300 mt-4">Cast & Crew</h4><div className="flex flex-wrap gap-1.5">{c.crewMembers.map((cm, i) => (<span key={i} className="px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-300">{cm.name} — <span className="text-orange-400">{cm.role}</span></span>))}</div></>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-slate-300">Media Assets</h4>
                      <div className="space-y-2 text-xs">
                        {[
                          { label: "Main Video", url: c.videoUrl },
                          { label: "Trailer", url: c.trailerUrl },
                          { label: "Poster", url: c.posterUrl },
                        ].map((a) => (
                          <div key={a.label} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${a.url ? "bg-green-400" : "bg-red-400"}`} />
                            <span className="text-slate-400">{a.label}:</span>
                            {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline truncate max-w-[200px] flex items-center gap-1"><ExternalLink className="w-3 h-3 flex-shrink-0" />Open</a> : <span className="text-red-400">Missing</span>}
                          </div>
                        ))}
                      </div>

                      {c.videoUrl && (
                        <button onClick={() => setPreviewing(c.id)} className="mt-3 flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg text-sm hover:bg-orange-500/20 transition">
                          <Play className="w-4 h-4" /> Watch Content
                        </button>
                      )}

                      {c.posterUrl && <img src={c.posterUrl} alt="" className="w-20 h-30 rounded-lg object-cover border border-slate-700/50 mt-3" />}

                      {c.reviewNote && (
                        <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 mt-3">
                          <p className="text-xs text-orange-400 font-medium">Previous Review Note:</p>
                          <p className="text-xs text-slate-400">{c.reviewNote}</p>
                        </div>
                      )}

                      <Link href={`/browse/content/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 mt-2">View Public Page <ExternalLink className="w-3 h-3" /></Link>
                    </div>
                  </div>

                  <div className="border-t border-slate-700/50 pt-5 space-y-3">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-orange-400" /> Review Actions</h4>
                    <textarea
                      value={noteById[c.id] ?? ""}
                      onChange={(e) => setNoteById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="Admin note (visible to creator on reject / changes)…"
                      rows={2}
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm"
                    />
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">Structured feedback (reject / request changes) — optional CTA deep-links</p>
                      {(feedbackById[c.id] ?? []).map((row, idx) => (
                        <div key={idx} className="flex flex-col gap-2 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 md:flex-row md:flex-wrap">
                          <select
                            value={row.kind}
                            onChange={(e) =>
                              setFeedbackById((prev) => {
                                const list = [...(prev[c.id] ?? [])];
                                list[idx] = { ...list[idx], kind: e.target.value as ReviewFeedbackKind };
                                return { ...prev, [c.id]: list };
                              })
                            }
                            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white"
                          >
                            {(["CATALOGUE", "SCRIPT", "METADATA", "LEGAL", "OTHER"] as const).map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                          <input
                            value={row.message}
                            onChange={(e) =>
                              setFeedbackById((prev) => {
                                const list = [...(prev[c.id] ?? [])];
                                list[idx] = { ...list[idx], message: e.target.value };
                                return { ...prev, [c.id]: list };
                              })
                            }
                            placeholder="What should they fix?"
                            className="min-w-[200px] flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs text-white"
                          />
                          <select
                            value={row.presetPath}
                            onChange={(e) =>
                              setFeedbackById((prev) => {
                                const list = [...(prev[c.id] ?? [])];
                                list[idx] = { ...list[idx], presetPath: e.target.value };
                                return { ...prev, [c.id]: list };
                              })
                            }
                            className="min-w-[180px] rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white"
                          >
                            <option value="">No button</option>
                            {REVIEW_CTA_PRESET_TEMPLATES.map((t) => (
                              <option key={t.path} value={t.path} disabled={t.path.includes("{projectId}") && !c.linkedProject}>
                                {t.label}
                                {t.path.includes("{projectId}") && !c.linkedProject ? " (needs link)" : ""}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setFeedbackById((prev) => {
                                const list = [...(prev[c.id] ?? [])].filter((_, i) => i !== idx);
                                return { ...prev, [c.id]: list };
                              })
                            }
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setFeedbackById((prev) => ({
                            ...prev,
                            [c.id]: [...(prev[c.id] ?? []), { kind: "CATALOGUE", message: "", presetPath: "" }],
                          }))
                        }
                        className="text-xs text-orange-400 hover:text-orange-300"
                      >
                        + Add feedback row
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.reviewStatus !== "APPROVED" && (
                        <button onClick={() => handleReview(c.id, "APPROVE")} disabled={actionLoading === c.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition text-sm disabled:opacity-50"><CheckCircle className="w-3.5 h-3.5" />Approve</button>
                      )}
                      {c.reviewStatus !== "APPROVED" && (
                        <button onClick={() => handleReview(c.id, "APPROVE", true)} disabled={actionLoading === c.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 transition text-sm disabled:opacity-50"><Star className="w-3.5 h-3.5" />Approve & Feature</button>
                      )}
                      {c.reviewStatus !== "REJECTED" && (
                        <button onClick={() => handleReview(c.id, "REJECT")} disabled={actionLoading === c.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition text-sm disabled:opacity-50"><XCircle className="w-3.5 h-3.5" />Reject</button>
                      )}
                      {c.reviewStatus !== "CHANGES_REQUESTED" && (
                        <button onClick={() => handleReview(c.id, "REQUEST_CHANGES")} disabled={actionLoading === c.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition text-sm disabled:opacity-50"><Send className="w-3.5 h-3.5" />Request Changes</button>
                      )}
                      {c.published && (
                        <button onClick={() => handleReview(c.id, "UNPUBLISH")} disabled={actionLoading === c.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/30 hover:bg-slate-500/20 transition text-sm disabled:opacity-50"><EyeOff className="w-3.5 h-3.5" />Unpublish</button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
