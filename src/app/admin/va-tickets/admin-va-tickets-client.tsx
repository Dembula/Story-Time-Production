"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bug,
  CheckCircle2,
  CircleDot,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ADMIN_DASHBOARD_REFETCH_MS } from "@/lib/dashboard-refresh";

type TicketRow = {
  id: string;
  ticketNumber: string;
  seq: number;
  kind: string;
  title: string;
  description: string;
  status: string;
  adminNotes: string | null;
  creatorVisibleNote: string | null;
  sourceSurface: string | null;
  sourcePath: string | null;
  toolSlug: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  createdBy: { id: string; name: string | null; email: string | null; role: string };
  reviewedBy: { id: string; name: string | null; email: string | null } | null;
};

const STATUS_FILTERS = [
  "all",
  "OPEN",
  "IN_PROGRESS",
  "APPROVED",
  "FIXED",
  "REJECTED",
  "CLOSED",
] as const;

const KIND_FILTERS = ["all", "FEATURE", "BUG", "IMPROVEMENT", "QUESTION"] as const;

function kindIcon(kind: string) {
  if (kind === "BUG") return <Bug className="h-3.5 w-3.5 text-rose-300" />;
  if (kind === "FEATURE") return <Sparkles className="h-3.5 w-3.5 text-amber-300" />;
  return <MessageSquareWarning className="h-3.5 w-3.5 text-sky-300" />;
}

function statusTone(status: string) {
  switch (status) {
    case "OPEN":
      return "border-amber-400/40 bg-amber-500/10 text-amber-200";
    case "IN_PROGRESS":
      return "border-sky-400/40 bg-sky-500/10 text-sky-200";
    case "APPROVED":
      return "border-violet-400/40 bg-violet-500/10 text-violet-200";
    case "FIXED":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
    case "REJECTED":
      return "border-rose-400/40 bg-rose-500/10 text-rose-200";
    default:
      return "border-white/15 bg-white/5 text-slate-300";
  }
}

export function AdminVaTicketsClient() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("OPEN");
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [adminDraft, setAdminDraft] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (kind) params.set("kind", kind);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/va-tickets?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tickets");
      setTickets(data.tickets ?? []);
      setByStatus(data.byStatus ?? {});
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Failed to load tickets",
      });
    } finally {
      setLoading(false);
    }
  }, [status, kind, q]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), ADMIN_DASHBOARD_REFETCH_MS);
    return () => clearInterval(t);
  }, [load]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? tickets[0] ?? null,
    [tickets, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setNoteDraft(selected.creatorVisibleNote ?? "");
    setAdminDraft(selected.adminNotes ?? "");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchStatus = async (nextStatus: string) => {
    if (!selected) return;
    setActionLoading(nextStatus);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/va-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          status: nextStatus,
          adminNotes: adminDraft,
          creatorVisibleNote: noteDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMessage({
        type: "ok",
        text: `${data.ticketNumber} → ${nextStatus}`,
      });
      await load();
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">System · VA</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-white">
            <Ticket className="h-6 w-6 text-orange-300" />
            VA tickets
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Feature requests and bugs filed by creators through the Virtual Assistant. Update status
            and leave a creator-facing note — the VA will read it back when they ask about their
            ticket number.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/15 bg-white/5 text-white"
          onClick={() => void load()}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1.5 ${
              status === s
                ? "border-orange-400/50 bg-orange-500/15 text-orange-200"
                : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
            {s !== "all" && byStatus[s] != null ? (
              <span className="ml-1 text-slate-500">({byStatus[s]})</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as (typeof KIND_FILTERS)[number])}
          className="h-9 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white"
        >
          {KIND_FILTERS.map((k) => (
            <option key={k} value={k}>
              {k === "all" ? "All kinds" : k}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ST-####, title, email…"
          className="h-9 min-w-[220px] flex-1 rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white placeholder:text-slate-500"
        />
      </div>

      {message ? (
        <p
          className={`text-sm ${message.type === "ok" ? "text-emerald-300" : "text-rose-300"}`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tickets…
            </div>
          ) : tickets.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-slate-500">
              No tickets match these filters.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-white/[0.04] ${
                      selected?.id === t.id ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-orange-300">{t.ticketNumber}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusTone(t.status)}`}
                      >
                        <CircleDot className="h-2.5 w-2.5" />
                        {t.status.replace("_", " ")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        {kindIcon(t.kind)}
                        {t.kind}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      {t.createdBy.name || t.createdBy.email || "Creator"} ·{" "}
                      {new Date(t.createdAt).toLocaleString()}
                      {t.toolSlug ? ` · ${t.toolSlug}` : ""}
                      {t.sourceSurface ? ` · ${t.sourceSurface}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-xl border border-white/10 bg-black/40 p-4">
          {!selected ? (
            <p className="py-10 text-center text-sm text-slate-500">Select a ticket</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-sm text-orange-300">{selected.ticketNumber}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{selected.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                  {selected.description}
                </p>
                <dl className="mt-3 space-y-1 text-xs text-slate-500">
                  <div>
                    Creator: {selected.createdBy.name || "—"} ({selected.createdBy.email})
                  </div>
                  {selected.sourcePath ? <div>Path: {selected.sourcePath}</div> : null}
                  {selected.projectId ? <div>Project: {selected.projectId}</div> : null}
                  {selected.reviewedBy ? (
                    <div>
                      Reviewed by {selected.reviewedBy.name || selected.reviewedBy.email}
                      {selected.reviewedAt
                        ? ` · ${new Date(selected.reviewedAt).toLocaleString()}`
                        : ""}
                    </div>
                  ) : null}
                </dl>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  Creator-facing note (VA will share this)
                </span>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="e.g. Shipping in next release / We won't add this because…"
                  className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  Internal admin notes
                </span>
                <textarea
                  value={adminDraft}
                  onChange={(e) => setAdminDraft(e.target.value)}
                  rows={2}
                  placeholder="Internal only"
                  className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!actionLoading}
                  className="border-sky-400/30 text-sky-200"
                  onClick={() => void patchStatus("IN_PROGRESS")}
                >
                  {actionLoading === "IN_PROGRESS" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CircleDot className="mr-1 h-3.5 w-3.5" />
                  )}
                  In progress
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!actionLoading}
                  className="border-violet-400/30 text-violet-200"
                  onClick={() => void patchStatus("APPROVED")}
                >
                  {actionLoading === "APPROVED" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                  )}
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!actionLoading}
                  className="border-emerald-400/30 text-emerald-200"
                  onClick={() => void patchStatus("FIXED")}
                >
                  {actionLoading === "FIXED" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Fixed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!actionLoading}
                  className="border-rose-400/30 text-rose-200"
                  onClick={() => void patchStatus("REJECTED")}
                >
                  {actionLoading === "REJECTED" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                  )}
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!!actionLoading}
                  className="text-slate-400"
                  onClick={() => void patchStatus("CLOSED")}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Close
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Reject requires a creator-facing note. Creators ask the VA “What&apos;s the status of{" "}
                {selected.ticketNumber}?” and hear your note in plain language.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
