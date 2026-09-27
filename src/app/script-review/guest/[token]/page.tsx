"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScriptReviewGuestStudio } from "@/components/script-review/script-review-guest-studio";

export default function ScriptReviewGuestPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["script-review-guest-preview", token],
    queryFn: async () => {
      const res = await fetch(`/api/script-review/guest/${encodeURIComponent(token)}/preview`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((j as { error?: string }).error || "Invite not found");
      }
      return j as {
        valid: boolean;
        inviterName: string;
        draftLabel: string;
        expiresAt: string | null;
        emailHint: string | null;
      };
    },
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/script-review/guest/session", { credentials: "include" });
      if (!cancelled && res.ok) setJoined(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (preview.data?.emailHint && !email) {
      setEmail(preview.data.emailHint);
    }
  }, [preview.data?.emailHint, email]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/script-review/guest/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email: email || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not join");
      return j;
    },
    onSuccess: () => {
      setJoined(true);
      router.refresh();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Could not join");
    },
  });

  if (joined) {
    return <ScriptReviewGuestStudio />;
  }

  if (preview.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-orange-300" />
      </div>
    );
  }

  if (preview.isError || !preview.data?.valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0b] px-6 text-center">
        <FileText className="h-10 w-10 text-slate-600" />
        <h1 className="text-lg font-semibold text-white">Invite unavailable</h1>
        <p className="max-w-md text-sm text-slate-400">
          {preview.error instanceof Error
            ? preview.error.message
            : "This guest link is invalid, expired, or was revoked."}
        </p>
      </div>
    );
  }

  const inviter = preview.data.inviterName;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121214] p-6 shadow-2xl md:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
          Script Review
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold leading-snug text-white">
          {inviter} invited you to review a script as a guest
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          You’ll read{" "}
          <span className="text-slate-200">{preview.data.draftLabel}</span> and leave
          review notes and comments. No Story Time account is required — this access is limited to
          this draft only.
        </p>
        {preview.data.expiresAt ? (
          <p className="mt-2 text-xs text-slate-500">
            Access until {new Date(preview.data.expiresAt).toLocaleString()}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Access runs until the creator revokes it.</p>
        )}

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            joinMutation.mutate();
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Your name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should comments show your name?"
              required
              minLength={2}
              className="border-white/10 bg-black/40 text-white"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">
              Email <span className="text-slate-500">(optional)</span>
            </span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border-white/10 bg-black/40 text-white"
            />
          </label>
          {formError ? <p className="text-xs text-red-300">{formError}</p> : null}
          <Button
            type="submit"
            className="w-full bg-orange-500 text-white hover:bg-orange-400"
            disabled={joinMutation.isPending || name.trim().length < 2}
          >
            {joinMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Enter guest review
          </Button>
        </form>
      </div>
    </div>
  );
}
