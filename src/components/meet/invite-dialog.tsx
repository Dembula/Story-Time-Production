"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Person = {
  id: string;
  name: string | null;
  professionalName: string | null;
  email: string | null;
  networkHandle: string | null;
  relationship: string;
};

type Props = {
  meetingId: string;
  open: boolean;
  onClose: () => void;
  guestUrl: string;
  /** Optional: show calendar save actions for scheduled Meets. */
  scheduledAt?: string | Date | null;
};

const LOCAL_EMAIL_KEY = "st-meet-invite-emails";

function loadLocalEmails(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_EMAIL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).map((e) => e.trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function rememberLocalEmails(emails: string[]) {
  try {
    const prev = loadLocalEmails();
    const next: string[] = [];
    const seen = new Set<string>();
    for (const email of [...emails, ...prev]) {
      const e = email.trim().toLowerCase();
      if (!e || seen.has(e)) continue;
      seen.add(e);
      next.push(e);
      if (next.length >= 40) break;
    }
    localStorage.setItem(LOCAL_EMAIL_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function MeetInviteDialog({ meetingId, open, onClose, guestUrl, scheduledAt }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localEmails, setLocalEmails] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["meet-network-invitees"],
    queryFn: async () => {
      const res = await fetch("/api/meet/network-invitees", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load network");
      return (await res.json()) as { people: Person[] };
    },
    enabled: open,
  });

  const { data: priorEmailData } = useQuery({
    queryKey: ["meet-invite-emails"],
    queryFn: async () => {
      const res = await fetch("/api/meet/invite-emails", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load prior emails");
      return (await res.json()) as { emails: string[] };
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setEmail("");
      setMsg(null);
      setCopied(false);
      return;
    }
    setLocalEmails(loadLocalEmails());
  }, [open]);

  const rememberedEmails = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of [...(priorEmailData?.emails ?? []), ...localEmails]) {
      const emailNorm = e.trim().toLowerCase();
      if (!emailNorm || seen.has(emailNorm)) continue;
      seen.add(emailNorm);
      out.push(emailNorm);
    }
    return out.slice(0, 24);
  }, [priorEmailData?.emails, localEmails]);

  if (!open) return null;

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const emails = email
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch(`/api/meet/meetings/${meetingId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds: selected, emails }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
      if (emails.length) {
        rememberLocalEmails(emails);
        setLocalEmails(loadLocalEmails());
      }
      setMsg(`Sent ${json.invites?.length ?? 0} invite(s).`);
      setSelected([]);
      setEmail("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121214] p-5 shadow-2xl md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/85">
              Invite
            </p>
            <h2 className="text-lg font-semibold text-white">Bring people into Meet</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Guests open the link → lobby → Join now. No meeting code to type.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/8 bg-black/30 p-2.5">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">{guestUrl}</p>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-500/15 px-2.5 py-1.5 text-[11px] text-orange-100 ring-1 ring-orange-400/25"
            onClick={() => {
              void navigator.clipboard.writeText(guestUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/8 bg-black/25 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Save to calendar
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Invite emails include a one-tap Join now lobby link, Google/Outlook buttons, and an .ics
            attachment
            {scheduledAt
              ? ` for ${new Date(scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
              : ""}
            .
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`/api/meet/meetings/${meetingId}/calendar`}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/[0.08]"
            >
              Download .ics
            </a>
          </div>
        </div>

        <label className="mb-2 block space-y-1.5">
          <span className="text-xs text-slate-400">Email invites (comma-separated)</span>
          <Input
            className="border-white/10 bg-black/40 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@studio.com"
          />
        </label>

        {rememberedEmails.length ? (
          <div className="mb-3">
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              Recent invites
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rememberedEmails.map((e) => {
                const already = email
                  .split(/[,;\s]+/)
                  .map((x) => x.trim().toLowerCase())
                  .includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      if (already) return;
                      setEmail((prev) => (prev.trim() ? `${prev.trim()}, ${e}` : e));
                    }}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      already
                        ? "border-orange-400/30 bg-orange-500/15 text-orange-100"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white",
                    ].join(" ")}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mb-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-black/20 p-2">
          <p className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-wide text-slate-500">
            Network — following & connected
          </p>
          {(data?.people ?? []).length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">
              Follow or connect with creators in Network to invite them here.
            </p>
          ) : (
            data!.people.map((p) => {
              const label = p.professionalName || p.name || p.networkHandle || p.email || p.id;
              const checked = selected.includes(p.id);
              return (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={checked}
                    onChange={() =>
                      setSelected((prev) =>
                        checked ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                      )
                    }
                  />
                  <span className="flex-1 truncate">{label}</span>
                  <span className="text-[10px] uppercase text-slate-500">{p.relationship}</span>
                </label>
              );
            })
          )}
        </div>

        {msg ? <p className="mb-3 text-xs text-slate-300">{msg}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-slate-300 hover:text-white"
          >
            Close
          </Button>
          <Button
            type="button"
            disabled={busy || (!selected.length && !email.trim())}
            onClick={() => void send()}
            className="bg-orange-500 text-white hover:bg-orange-400"
          >
            {busy ? "Sending…" : "Send invites"}
          </Button>
        </div>
      </div>
    </div>
  );
}
