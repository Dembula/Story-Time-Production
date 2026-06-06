"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";
import { normalizeInviteEmail } from "@/lib/creator-team-invites";

type Preview = {
  valid: boolean;
  companyName?: string;
  emailNorm?: string;
  expired?: boolean;
  status?: string;
  error?: string;
};

export function JoinCompanyInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const callbackUrl = encodeURIComponent(`/creator/join/company/${token}`);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["team-invite-preview", token],
    queryFn: async () => {
      const r = await fetch(`/api/creator/team-invites/preview?token=${encodeURIComponent(token)}`);
      const j = (await r.json().catch(() => ({}))) as Preview & Record<string, unknown>;
      if (!r.ok) return { valid: false, error: typeof j.error === "string" ? j.error : "Invalid link" };
      return j as Preview;
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/creator/team-invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "accept" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not accept");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY] });
      const role = session?.user?.role;
      router.push(role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/command-center");
      router.refresh();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  if (!preview?.valid && preview?.error) {
    return <p className="text-center text-sm text-red-400">{preview.error}</p>;
  }

  if (!preview?.valid) {
    return (
      <p className="text-center text-sm text-slate-400">
        This invite is {preview?.expired ? "expired" : "no longer valid"}.
      </p>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="space-y-4 text-center text-sm text-slate-300">
        <p>
          You have been invited to join <strong className="text-white">{preview.companyName}</strong>. Sign in with
          the invited email, then return to this page.
        </p>
        <Link
          href={`/auth/creator/signin?callbackUrl=${callbackUrl}`}
          className="inline-block rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-400"
        >
          Creator sign in
        </Link>
        <p className="text-xs text-slate-500">
          New to Story Time?{" "}
          <Link
            href={`/auth/creator/signup?callbackUrl=${callbackUrl}`}
            className="text-orange-300 hover:underline"
          >
            Create a creator account
          </Link>{" "}
          using the same email the owner invited.
        </p>
      </div>
    );
  }

  const sessionEmail = session?.user?.email ? normalizeInviteEmail(session.user.email) : "";
  const invitedEmail = preview.emailNorm ?? "";
  if (invitedEmail && sessionEmail && sessionEmail !== invitedEmail) {
    return (
      <p className="text-center text-sm text-amber-400">
        This invite was sent to <span className="font-medium text-slate-200">{invitedEmail}</span>. You are signed in
        as <span className="font-medium text-slate-200">{session?.user?.email}</span>. Sign out and sign in with the
        invited address, or ask the studio owner to send a new invite to your current email.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-white">Join {preview.companyName}</h1>
      <p className="text-sm text-slate-400">Accepting creates a company workspace profile under this studio.</p>
      <button
        type="button"
        disabled={accept.isPending}
        onClick={() => accept.mutate()}
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
      >
        {accept.isPending ? "Joining…" : "Accept invite"}
      </button>
      {accept.error ? <p className="text-xs text-red-400">{(accept.error as Error).message}</p> : null}
    </div>
  );
}
