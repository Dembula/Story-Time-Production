"use client";

import { useEffect, useState } from "react";
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
};

export function MeetInviteDialog({ meetingId, open, onClose, guestUrl }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["meet-network-invitees"],
    queryFn: async () => {
      const res = await fetch("/api/meet/network-invitees", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load network");
      return (await res.json()) as { people: Person[] };
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setEmail("");
      setMsg(null);
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const emails = email
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      const res = await fetch(`/api/meet/meetings/${meetingId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds: selected, emails }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
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

        <label className="mb-3 block space-y-1.5">
          <span className="text-xs text-slate-400">Email (comma-separated)</span>
          <Input
            className="border-white/10 bg-black/40 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@studio.com"
          />
        </label>

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
