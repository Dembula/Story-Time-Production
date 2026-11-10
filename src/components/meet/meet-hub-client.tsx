"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Video, FileText, Link2, Sparkles, ArrowRight, CalendarPlus } from "lucide-react";
import { MeetInviteDialog } from "@/components/meet/invite-dialog";

type MeetingRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  updatedAt: string;
  summary?: { id: string } | null;
  host?: { name: string | null };
};

function parseInviteEmails(raw: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n\r]+/).flatMap((c) => c.split(/\s+/))) {
    const s = part.trim().toLowerCase();
    const angle = s.match(/<([^>\s]+@[^>\s]+)>/);
    const email = (angle?.[1] || s.replace(/^mailto:/i, "")).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
    if (out.length >= 40) break;
  }
  return out;
}

/** Convert ISO / Date to value for <input type="datetime-local"> in local time. */
function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetHubClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Creative sync");
  const [joinCode, setJoinCode] = useState("");
  const [passcode, setPasscode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [roomPasscode, setRoomPasscode] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteMeeting, setInviteMeeting] = useState<MeetingRow | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<MeetingRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["meet-meetings"],
    queryFn: async () => {
      const res = await fetch("/api/meet/meetings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load meetings");
      return (await res.json()) as { meetings: MeetingRow[] };
    },
  });

  const { data: summariesData } = useQuery({
    queryKey: ["meet-summaries"],
    queryFn: async () => {
      const res = await fetch("/api/meet/summaries", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summaries");
      return (await res.json()) as {
        summaries: Array<{ id: string; title: string; createdAt: string; summary: string }>;
      };
    },
  });

  const createMeeting = useMutation({
    mutationFn: async (mode: "now" | "schedule") => {
      const emails = mode === "schedule" ? parseInviteEmails(inviteEmails) : [];
      const res = await fetch("/api/meet/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          joinNow: mode === "now",
          waitingRoom: true,
          passcode: roomPasscode.trim() || null,
          scheduledAt: mode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          inviteEmails: emails,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      return json as {
        meeting: MeetingRow;
        calendarEventId?: string | null;
        invitesSent?: number;
        invitesFailed?: number;
        inviteErrors?: string[];
        emailTransportConfigured?: boolean;
        absoluteGuestUrl?: string;
      };
    },
    onSuccess: (json, mode) => {
      void queryClient.invalidateQueries({ queryKey: ["meet-meetings"] });
      if (mode === "now") {
        router.push(`/creator/meet/room/${json.meeting.id}`);
        return;
      }
      const requested = parseInviteEmails(inviteEmails).length;
      const parts = [
        `Scheduled “${json.meeting.title}”. Code ${json.meeting.code}.`,
        json.calendarEventId ? "Added to your production calendar." : null,
        json.invitesSent
          ? `Sent ${json.invitesSent} email invite${json.invitesSent === 1 ? "" : "s"}.`
          : null,
        requested > 0 && (json.invitesFailed ?? 0) > 0
          ? `Could not deliver ${json.invitesFailed} invite email${json.invitesFailed === 1 ? "" : "s"}${
              json.inviteErrors?.[0] ? ` (${json.inviteErrors[0]})` : ""
            }. Use Email invites to retry.`
          : null,
        requested > 0 && !json.invitesSent && !json.emailTransportConfigured
          ? "Email delivery is not configured on the server — invites were saved but not emailed."
          : null,
        requested > 0 && !json.invitesSent && json.emailTransportConfigured && !(json.invitesFailed ?? 0)
          ? "No invite emails were parsed — check the addresses and try Email invites."
          : null,
      ].filter(Boolean);
      setMsg(parts.join(" "));
      setInviteEmails("");
      setInviteMeeting(json.meeting);
    },
    onError: (err: Error) => setMsg(err.message),
  });

  const joinMeeting = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meet/meetings/join-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: joinCode.trim(), passcode: passcode.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Join failed");
      return json as { dbMeetingId: string };
    },
    onSuccess: (json) => router.push(`/creator/meet/room/${json.dbMeetingId}`),
    onError: (err: Error) => setMsg(err.message),
  });

  const updateScheduled = useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      scheduledAt?: string;
      cancel?: boolean;
    }) => {
      const res = await fetch(`/api/meet/meetings/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          input.cancel
            ? { status: "CANCELLED", notifyInvitees: true }
            : {
                title: input.title,
                scheduledAt: input.scheduledAt
                  ? new Date(input.scheduledAt).toISOString()
                  : undefined,
                notifyInvitees: true,
              },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      return json as { meeting: MeetingRow; notified?: number; notifyFailed?: number };
    },
    onSuccess: (json, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["meet-meetings"] });
      setEditingMeeting(null);
      const notified = json.notified ?? 0;
      if (vars.cancel) {
        setMsg(
          `Cancelled “${json.meeting.title}”${
            notified ? ` · notified ${notified} invitee${notified === 1 ? "" : "s"}` : ""
          }.`,
        );
      } else {
        setMsg(
          `Updated “${json.meeting.title}”${
            notified ? ` · notified ${notified} invitee${notified === 1 ? "" : "s"}` : ""
          }.`,
        );
      }
    },
    onError: (err: Error) => setMsg(err.message),
  });

  const live = (data?.meetings ?? []).filter((m) => m.status === "LIVE");
  const scheduled = (data?.meetings ?? []).filter((m) => m.status === "SCHEDULED");
  const recent = (data?.meetings ?? [])
    .filter((m) => m.status !== "LIVE" && m.status !== "SCHEDULED")
    .slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-12">
      <header className="storytime-plan-card space-y-3 p-6 md:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
          Story Time
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Meet
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Host creative calls for up to 20 people with HD video, screen share, reactions,
              network invites, guest links, and VA notes — outside the production pipeline.
            </p>
          </div>
          <Link
            href="/creator/meet/summaries"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:border-orange-400/30 hover:text-white"
          >
            <FileText className="h-3.5 w-3.5 text-orange-300" />
            Summaries
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            "Up to 20 people",
            "Waiting room",
            "Host controls",
            "Minimize while sharing",
            "VA notes",
          ].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/8 bg-black/30 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-400"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      {msg ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            /failed|error|could not/i.test(msg)
              ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-50",
          ].join(" ")}
        >
          {msg}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="storytime-plan-card space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
              <Video className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Start a Meet</h2>
              <p className="text-xs text-slate-500">Instant room with waiting room on</p>
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Title</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400/40"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Table read briefing"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Passcode (optional)</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400/40"
              value={roomPasscode}
              onChange={(e) => setRoomPasscode(e.target.value)}
              placeholder="Shared in invite email"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Schedule (optional)</span>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400/40"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          {scheduledAt ? (
            <label className="block space-y-1.5">
              <span className="text-xs text-slate-400">
                Email invites for this schedule (optional)
              </span>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400/40"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="producer@studio.com, client@brand.com"
              />
              <span className="block text-[11px] leading-relaxed text-slate-500">
                Recipients get the join link plus Google/Outlook buttons and an .ics calendar file.
              </span>
            </label>
          ) : null}
          <p className="text-[11px] leading-relaxed text-slate-500">
            Instant and scheduled Meets are added to your production calendar with the join link,
            code, and passcode.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={createMeeting.isPending}
              onClick={() => {
                setMsg(null);
                createMeeting.mutate("now");
              }}
              className="rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-orange-400 disabled:opacity-50"
            >
              {createMeeting.isPending ? "Starting…" : "Start Meet now"}
            </button>
            <button
              type="button"
              disabled={createMeeting.isPending || !scheduledAt}
              onClick={() => {
                setMsg(null);
                createMeeting.mutate("schedule");
              }}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Schedule &amp; invite
            </button>
          </div>
        </div>

        <div className="storytime-plan-card space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Join with code</h2>
              <p className="text-xs text-slate-500">Paste a Meet code from a teammate</p>
            </div>
          </div>
          <input
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm tracking-wider text-white outline-none focus:border-orange-400/40"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ST-XXXXXX"
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400/40"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode (optional)"
          />
          <button
            type="button"
            disabled={joinMeeting.isPending || !joinCode.trim()}
            onClick={() => {
              setMsg(null);
              joinMeeting.mutate();
            }}
            className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {joinMeeting.isPending ? "Joining…" : "Join meeting"}
          </button>
        </div>
      </section>

      {live.length > 0 ? (
        <section className="storytime-plan-card p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <h2 className="font-semibold text-white">Live now</h2>
          </div>
          <ul className="space-y-2">
            {live.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{m.title}</p>
                  <p className="font-mono text-xs text-slate-500">{m.code}</p>
                </div>
                <Link
                  href={`/creator/meet/room/${m.id}`}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-400/30"
                >
                  Rejoin
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scheduled.length > 0 ? (
        <section className="storytime-plan-card p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-sky-300" />
            <h2 className="font-semibold text-white">Scheduled</h2>
          </div>
          <ul className="space-y-3">
            {scheduled.map((m) => {
              const isEditing = editingMeeting?.id === m.id;
              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3"
                >
                  {!isEditing ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{m.title}</p>
                        <p className="text-xs text-slate-400">
                          {m.scheduledAt
                            ? new Date(m.scheduledAt).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "Time TBD"}
                          {" · "}
                          <span className="font-mono text-slate-500">{m.code}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMeeting(m);
                            setEditTitle(m.title);
                            setEditScheduledAt(toDatetimeLocalValue(m.scheduledAt));
                            setMsg(null);
                          }}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={updateScheduled.isPending}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Cancel “${m.title}”? Invitees will be emailed that it was cancelled.`,
                              )
                            ) {
                              return;
                            }
                            setMsg(null);
                            updateScheduled.mutate({ id: m.id, cancel: true });
                          }}
                          className="rounded-lg border border-rose-400/25 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <a
                          href={`/api/meet/meetings/${m.id}/calendar`}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08]"
                        >
                          Save .ics
                        </a>
                        <button
                          type="button"
                          onClick={() => setInviteMeeting(m)}
                          className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-100 ring-1 ring-sky-400/30"
                        >
                          Email invites
                        </button>
                        <Link
                          href={`/creator/meet/room/${m.id}`}
                          className="rounded-lg bg-orange-500/15 px-3 py-1.5 text-xs text-orange-100 ring-1 ring-orange-400/25"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/80">
                        Edit scheduled Meet
                      </p>
                      <label className="block space-y-1.5">
                        <span className="text-xs text-slate-400">Title</span>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400/40"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs text-slate-400">Date &amp; time</span>
                        <input
                          type="datetime-local"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400/40"
                          value={editScheduledAt}
                          onChange={(e) => setEditScheduledAt(e.target.value)}
                        />
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Saving notifies people who already received an invite email.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            updateScheduled.isPending ||
                            !editTitle.trim() ||
                            !editScheduledAt
                          }
                          onClick={() => {
                            setMsg(null);
                            updateScheduled.mutate({
                              id: m.id,
                              title: editTitle.trim(),
                              scheduledAt: editScheduledAt,
                            });
                          }}
                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                        >
                          {updateScheduled.isPending ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMeeting(null)}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08]"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="storytime-plan-card p-5 md:p-6">
        <h2 className="mb-4 font-semibold text-white">Recent meetings</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : recent.length === 0 && live.length === 0 && scheduled.length === 0 ? (
          <p className="text-sm text-slate-500">
            No meetings yet. Start one above, then invite from Network or share the guest link.
          </p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-slate-500">Ended meetings will show up here.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                <div>
                  <p className="text-sm font-medium text-white">{m.title}</p>
                  <p className="text-xs text-slate-500">
                    {m.status} · <span className="font-mono">{m.code}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {m.status !== "ENDED" ? (
                    <Link
                      href={`/creator/meet/room/${m.id}`}
                      className="rounded-lg bg-orange-500/15 px-3 py-1.5 text-xs text-orange-100 ring-1 ring-orange-400/25"
                    >
                      Open
                    </Link>
                  ) : null}
                  {m.summary ? (
                    <Link
                      href="/creator/meet/summaries"
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300"
                    >
                      Summary
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inviteMeeting ? (
        <MeetInviteDialog
          open
          meetingId={inviteMeeting.id}
          guestUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/meet/${inviteMeeting.code}`
              : `/meet/${inviteMeeting.code}`
          }
          scheduledAt={inviteMeeting.scheduledAt}
          onClose={() => setInviteMeeting(null)}
        />
      ) : null}
      <section className="storytime-plan-card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-300" />
            <h2 className="font-semibold text-white">VA summaries</h2>
          </div>
          <Link href="/creator/meet/summaries" className="text-xs text-slate-400 hover:text-orange-200">
            View all
          </Link>
        </div>
        {(summariesData?.summaries ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">
            After you leave a Meet, the VA drafts a summary you can download as PDF.
          </p>
        ) : (
          <ul className="space-y-2">
            {summariesData!.summaries.slice(0, 4).map((s) => (
              <li key={s.id} className="rounded-xl border border-white/6 bg-black/25 px-4 py-3">
                <p className="text-sm text-white">{s.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{s.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
