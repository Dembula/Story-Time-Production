"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, Mail, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EDIT_REVIEW_GUEST_DURATIONS,
  type EditReviewGuestDurationKey,
} from "@/lib/edit-review/guest-durations";
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

type EditReviewGuestInvitePanelProps = {
  projectId: string;
  reviewId: string;
  open: boolean;
  onClose: () => void;
};

export function EditReviewGuestInvitePanel({
  projectId,
  reviewId,
  open,
  onClose,
}: EditReviewGuestInvitePanelProps) {
  const queryClient = useQueryClient();
  const [durationKey, setDurationKey] = useState<EditReviewGuestDurationKey>("7d");
  const [email, setEmail] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["edit-review-guests", projectId, reviewId],
    queryFn: async () => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/reviews/${reviewId}/guests`,
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to load invites");
      return j as { invites: GuestInviteRow[] };
    },
    enabled: open && Boolean(projectId && reviewId),
  });

  const createMutation = useMutation({
    mutationFn: async (opts: { sendEmail: boolean }) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/reviews/${reviewId}/guests`,
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
        queryKey: ["edit-review-guests", projectId, reviewId],
      });
      try {
        await navigator.clipboard.writeText(result.invite.url);
        setCopiedId(result.invite.id);
        window.setTimeout(() => setCopiedId(null), 2000);
      } catch {
        /* ignore clipboard failures */
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not create invite");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(
        `/api/creator/projects/${projectId}/reviews/${reviewId}/guests?inviteId=${encodeURIComponent(inviteId)}`,
        { method: "DELETE" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not revoke");
      return inviteId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["edit-review-guests", projectId, reviewId],
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
              Guests only see this cut — no version list, no other creator tools.
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
              onChange={(e) =>
                setDurationKey(e.target.value as EditReviewGuestDurationKey)
              }
              className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
            >
              {EDIT_REVIEW_GUEST_DURATIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">
              Email <span className="text-slate-500">(optional)</span>
            </span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guest@studio.com"
              className="border-white/10 bg-black/40 text-white"
            />
          </label>

          {error ? <p className="text-xs text-red-300">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-orange-500 text-white hover:bg-orange-400"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate({ sendEmail: false })}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Create &amp; copy link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15 text-slate-200"
              disabled={createMutation.isPending || !email.trim()}
              onClick={() => createMutation.mutate({ sendEmail: true })}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Email invite
            </Button>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Active &amp; recent links
          </p>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : invites.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">No guest invites yet.</p>
          ) : (
            <ul className="space-y-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className={cn(
                    "rounded-lg border px-3 py-2.5",
                    invite.active
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-white/5 bg-black/20 opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-slate-200">
                        {invite.email || "Share link"}
                        {!invite.active ? (
                          <span className="ml-2 text-[10px] text-red-300/80">
                            {invite.revokedAt ? "revoked" : "expired"}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {invite.durationLabel}
                        {invite.expiresAt
                          ? ` · until ${new Date(invite.expiresAt).toLocaleString()}`
                          : " · no end date"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {invite.active ? (
                        <>
                          <button
                            type="button"
                            title="Copy link"
                            className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(invite.url);
                                setCopiedId(invite.id);
                                window.setTimeout(() => setCopiedId(null), 2000);
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            {copiedId === invite.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Revoke access"
                            className="rounded p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-300"
                            disabled={revokeMutation.isPending}
                            onClick={() => {
                              if (!window.confirm("Revoke this guest link? Guests will lose access immediately.")) {
                                return;
                              }
                              revokeMutation.mutate(invite.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
