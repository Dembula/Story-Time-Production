"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Mail, Trash2, X } from "lucide-react";
import {
  STORYBOARD_GUEST_DURATIONS,
  type StoryboardGuestDurationKey,
} from "@/lib/storyboard/guest-durations";
import { cn } from "@/lib/utils";

type GuestInviteRow = {
  id: string;
  url: string;
  email: string | null;
  durationKey: string;
  durationLabel: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
};

export function StoryboardGuestInvitePanel({
  projectId,
  boardId,
  open,
  onClose,
}: {
  projectId: string;
  boardId: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [durationKey, setDurationKey] = useState<StoryboardGuestDurationKey>("7d");
  const [email, setEmail] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["storyboard-guests", projectId, boardId],
    queryFn: async () => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/storyboard/${boardId}/guests`,
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to load invites");
      return j as { invites: GuestInviteRow[] };
    },
    enabled: open && Boolean(projectId && boardId),
  });

  const createMutation = useMutation({
    mutationFn: async (opts: { sendEmail: boolean }) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/storyboard/${boardId}/guests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            durationKey,
            email: email.trim() || undefined,
            sendEmail: opts.sendEmail,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not create invite");
      return j as { invite: GuestInviteRow; emailSent: boolean };
    },
    onSuccess: async (result) => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["storyboard-guests", projectId, boardId],
      });
      try {
        await navigator.clipboard.writeText(result.invite.url);
        setCopiedId(result.invite.id);
        window.setTimeout(() => setCopiedId(null), 2000);
      } catch {
        /* ignore */
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not create invite");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/storyboard/${boardId}/guests?inviteId=${encodeURIComponent(inviteId)}`,
        { method: "DELETE" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not revoke");
      return inviteId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyboard-guests", projectId, boardId],
      });
    },
  });

  if (!open) return null;

  const invites = data?.invites ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Invite guests</p>
            <p className="mt-1 text-xs text-slate-500">
              View-only access to this storyboard for a limited time — no other creator tools.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Access duration</span>
            <select
              value={durationKey}
              onChange={(e) => setDurationKey(e.target.value as StoryboardGuestDurationKey)}
              className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
            >
              {STORYBOARD_GUEST_DURATIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Email (optional)</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guest@example.com"
              className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
            />
          </label>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => void createMutation.mutate({ sendEmail: false })}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Create & copy link
            </button>
            <button
              type="button"
              disabled={createMutation.isPending || !email.trim()}
              onClick={() => void createMutation.mutate({ sendEmail: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" /> Email invite
            </button>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs font-medium text-slate-400">Active invites</p>
            {isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
            {invites.length === 0 && !isLoading ? (
              <p className="text-xs text-slate-500">No invites yet.</p>
            ) : null}
            {invites.map((invite) => (
              <div
                key={invite.id}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs",
                  invite.active
                    ? "border-slate-700 bg-slate-900/50"
                    : "border-slate-800 bg-slate-950/40 opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-slate-200">{invite.url}</p>
                    <p className="mt-1 text-slate-500">
                      {invite.durationLabel}
                      {invite.email ? ` · ${invite.email}` : ""}
                      {!invite.active ? " · revoked/expired" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(invite.url);
                          setCopiedId(invite.id);
                          window.setTimeout(() => setCopiedId(null), 2000);
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="rounded p-1.5 text-slate-400 hover:bg-white/5"
                    >
                      {copiedId === invite.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {invite.active ? (
                      <button
                        type="button"
                        onClick={() => void revokeMutation.mutate(invite.id)}
                        className="rounded p-1.5 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
