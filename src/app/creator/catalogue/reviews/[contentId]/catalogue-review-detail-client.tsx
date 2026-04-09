"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { parseReviewFeedback, type ReviewFeedbackItem } from "@/lib/review-feedback";

type ContentRow = {
  id: string;
  title: string;
  reviewStatus: string;
  reviewNote: string | null;
  reviewFeedback: unknown;
  linkedProject: { id: string; title: string } | null;
};

const statusMeta: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  PENDING: { label: "Submitted for review", icon: Clock, className: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  REJECTED: { label: "Rejected", icon: XCircle, className: "text-red-400 border-red-500/30 bg-red-500/10" },
  CHANGES_REQUESTED: { label: "Changes requested", icon: AlertTriangle, className: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  APPROVED: { label: "Approved", icon: CheckCircle, className: "text-green-400 border-green-500/30 bg-green-500/10" },
  DRAFT: { label: "Draft", icon: Clock, className: "text-slate-400 border-white/10 bg-white/[0.04]" },
  UNPUBLISHED: { label: "Unpublished", icon: AlertTriangle, className: "text-slate-400 border-white/10 bg-white/[0.04]" },
};

export function CatalogueReviewDetailClient({ contentId }: { contentId: string }) {
  const [data, setData] = useState<ContentRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/creator/content?id=${encodeURIComponent(contentId)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setError(j.error || "Could not load review");
          return;
        }
        setData(j);
      })
      .catch(() => setError("Could not load review"));
  }, [contentId]);

  if (error) {
    return (
      <div className="px-6 py-10">
        <div className="storytime-plan-card mx-auto max-w-lg p-6 text-center text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  const meta = statusMeta[data.reviewStatus] ?? statusMeta.PENDING;
  const Icon = meta.icon;
  const items = parseReviewFeedback(data.reviewFeedback as Parameters<typeof parseReviewFeedback>[0]);

  return (
    <div className="space-y-8 px-6 py-8 md:px-12 md:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/creator/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Projects
        </Link>

        <header className="storytime-plan-card p-5 md:p-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Catalogue review</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">{data.title}</h1>
          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${meta.className}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {meta.label}
          </div>
          {data.linkedProject && (
            <p className="mt-3 text-xs text-slate-500">
              Linked project:{" "}
              <span className="text-slate-300">{data.linkedProject.title}</span>
            </p>
          )}
        </header>

        {(data.reviewStatus === "REJECTED" ||
          data.reviewStatus === "CHANGES_REQUESTED" ||
          data.reviewStatus === "UNPUBLISHED") && (
          <section className="creator-glass-panel space-y-3 rounded-2xl border border-white/10 p-5 md:p-6">
            <h2 className="text-sm font-semibold text-white">From the review team</h2>
            <p className="text-sm leading-relaxed text-slate-400 whitespace-pre-wrap">
              {data.reviewNote || "No additional note was provided."}
            </p>
          </section>
        )}

        {items.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">What to update</h2>
            <ul className="space-y-3">
              {items.map((item: ReviewFeedbackItem, i) => (
                <li key={i} className="creator-glass-panel rounded-xl border border-white/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-300/80">{item.kind}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.message}</p>
                  {item.ctaPath && (
                    <Link
                      href={item.ctaPath}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-200 transition hover:bg-orange-500/15"
                    >
                      {item.ctaLabel || "Open in app"} <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/creator/upload"
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600"
          >
            Catalogue upload
          </Link>
          {data.linkedProject && (
            <Link
              href={`/creator/projects/${data.linkedProject.id}/workspace`}
              className="inline-flex items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06]"
            >
              Project workspace
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
