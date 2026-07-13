"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Film, Pencil, Plus, Eye, AlertCircle } from "lucide-react";
import { isEditableCatalogueStatus } from "@/lib/catalogue-upload/types";
import { isLongFormType } from "@/lib/content-types";

type CatalogueItem = {
  id: string;
  title: string;
  type: string;
  reviewStatus: string;
  published: boolean;
  posterUrl?: string | null;
  submittedAt?: string | null;
  updatedAt?: string;
  seasons?: Array<{ seasonNumber: number; published: boolean }>;
};

function statusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "AWAITING_PAYMENT":
      return "Awaiting payment";
    case "PENDING":
      return "In review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "UNPUBLISHED":
      return "Unpublished";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "DRAFT":
      return "border-slate-500/40 bg-slate-500/10 text-slate-300";
    case "AWAITING_PAYMENT":
      return "border-amber-400/40 bg-amber-500/10 text-amber-200";
    case "PENDING":
      return "border-sky-400/40 bg-sky-500/10 text-sky-200";
    case "APPROVED":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
    case "REJECTED":
    case "CHANGES_REQUESTED":
      return "border-orange-400/40 bg-orange-500/10 text-orange-200";
    default:
      return "border-white/15 bg-white/5 text-slate-300";
  }
}

export function MyCatalogueClient() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["creator-catalogue"],
    queryFn: async () => {
      const res = await fetch("/api/creator/content");
      if (!res.ok) throw new Error("Failed to load catalogue");
      return (await res.json()) as CatalogueItem[];
    },
  });

  const items = Array.isArray(data) ? data : [];

  return (
    <div className="px-6 py-8 md:px-12 md:py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="storytime-plan-card p-5 md:p-6 lg:p-8">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
            Monetization
          </p>
          <h1 className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
            <Film className="h-8 w-8 shrink-0 text-orange-500" />
            My catalogue
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            Manage titles you have submitted for distribution. Edit drafts and returned titles, track
            review status, and add seasons to approved series — without confusing live review or
            approved catalogue entries.
          </p>
          <div className="mt-4">
            <Link
              href="/creator/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              New catalogue upload
            </Link>
          </div>
        </header>

        {isLoading ? (
          <p className="text-sm text-slate-400">Loading your titles…</p>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="h-4 w-4" />
            Could not load catalogue titles.
          </div>
        ) : items.length === 0 ? (
          <div className="creator-glass-panel rounded-xl border border-white/8 p-8 text-center">
            <p className="text-sm text-slate-300">No catalogue titles yet.</p>
            <Link href="/creator/upload" className="mt-3 inline-block text-sm text-orange-300 hover:text-orange-200">
              Start your first upload
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const editable = isEditableCatalogueStatus(item.reviewStatus);
              const canAddSeason =
                item.reviewStatus === "APPROVED" && isLongFormType(item.type);
              return (
                <li
                  key={item.id}
                  className="creator-glass-panel flex flex-col gap-4 rounded-xl border border-white/8 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-medium text-white">{item.title}</h2>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass(item.reviewStatus)}`}
                      >
                        {statusLabel(item.reviewStatus)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.type}
                      {item.submittedAt
                        ? ` · Submitted ${new Date(item.submittedAt).toLocaleDateString()}`
                        : " · Not submitted"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editable ? (
                      <Link
                        href={`/creator/upload?contentId=${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-orange-400/30 px-3 py-1.5 text-xs font-medium text-orange-200 hover:bg-orange-500/10"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    ) : null}
                    {(item.reviewStatus === "REJECTED" ||
                      item.reviewStatus === "CHANGES_REQUESTED" ||
                      item.reviewStatus === "PENDING" ||
                      item.reviewStatus === "APPROVED") && (
                      <Link
                        href={`/creator/catalogue/reviews/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {item.reviewStatus === "PENDING" ? "View status" : "Review details"}
                      </Link>
                    )}
                    {canAddSeason ? (
                      <Link
                        href={`/creator/upload/season?contentId=${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add season
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
