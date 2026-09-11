"use client";

import { StoryTimeLoader } from "@/components/ui/storytime-loader";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeInviteEmail } from "@/lib/creator-team-invites";

type Preview = {
  valid: boolean;
  projectTitle?: string;
  invitedByName?: string;
  emailNorm?: string;
  role?: string;
  personalMessage?: string | null;
  expired?: boolean;
  status?: string;
  error?: string;
};

export function JoinProjectInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const callbackUrl = encodeURIComponent(`/creator/join/project/${token}`);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["project-invite-preview", token],
    queryFn: async () => {
      const r = await fetch(`/api/creator/project-invites/preview?token=${encodeURIComponent(token)}`);
      const j = (await r.json().catch(() => ({}))) as Preview & Record<string, unknown>;
      if (!r.ok) return { valid: false, error: typeof j.error === "string" ? j.error : "Invalid link" };
      return j as Preview;
    },
  });

  const accept = useMutation({
    mutationFn: async (action: "accept" | "decline") => {
      const res = await fetch("/api/creator/project-invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not update invite");
      return j as { projectId?: string; alreadyAccepted?: boolean };
    },
    onSuccess: (data, action) => {
      void queryClient.invalidateQueries({ queryKey: ["creator-projects"] });
      if (action === "accept" && data.projectId) {
        router.push(`/creator/dashboard?project=${encodeURIComponent(data.projectId)}`);
      } else {
        router.push("/creator/dashboard");
      }
      router.refresh();
    },
  });

  // If signup already auto-granted access, open the project immediately.
  useEffect(() => {
    if (status !== "authenticated" || !preview?.valid) return;
    if (preview.status === "ACCEPTED") {
      void accept.mutateAsync("accept").catch(() => {
        // fall through to manual accept UI
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when preview says already accepted
  }, [status, preview?.valid, preview?.status]);

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
      <div className="mx-auto max-w-md space-y-4 text-center text-sm text-slate-300">
        <h1 className="font-display text-2xl font-semibold text-white">
          Join {preview.projectTitle}
        </h1>
        <p>
          <strong className="text-white">{preview.invitedByName}</strong> invited you to collaborate
          {preview.role ? <> as <strong className="text-white">{preview.role}</strong></> : null}.
        </p>
        {preview.personalMessage ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-slate-400">
            {preview.personalMessage}
          </p>
        ) : null}
        <p>
          {preview.status === "ACCEPTED"
            ? "Sign in with the invited email to open the project."
            : "Create a creator account with the invited email (or sign in), then accept to join the project."}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={`/auth/creator/signin?callbackUrl=${callbackUrl}`}
            className="inline-block rounded-lg bg-orange-500 px-4 py-2.5 font-medium text-white hover:bg-orange-400"
          >
            Creator sign in
          </Link>
          <Link
            href={`/auth/creator/signup?callbackUrl=${callbackUrl}`}
            className="inline-block rounded-lg border border-white/15 px-4 py-2.5 font-medium text-slate-200 hover:bg-white/[0.04]"
          >
            Create creator account
          </Link>
        </div>
        <p className="text-xs text-slate-500">Invited email: {preview.emailNorm}</p>
      </div>
    );
  }

  const sessionEmail = session?.user?.email ? normalizeInviteEmail(session.user.email) : "";
  const invitedEmail = preview.emailNorm ?? "";
  if (invitedEmail && sessionEmail && sessionEmail !== invitedEmail) {
    return (
      <p className="mx-auto max-w-md text-center text-sm text-amber-400">
        This invite was sent to <span className="font-medium text-slate-200">{invitedEmail}</span>. You are signed in
        as <span className="font-medium text-slate-200">{session?.user?.email}</span>. Sign out and use the invited
        email, or ask for a new invite.
      </p>
    );
  }

  const role = session?.user?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return (
      <p className="mx-auto max-w-md text-center text-sm text-amber-300">
        Switch to a creator account to accept this project invite.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-white">Join {preview.projectTitle}</h1>
      <p className="text-sm text-slate-400">
        Accepting adds you as {preview.role || "Collaborator"} on this project.
      </p>
      {preview.personalMessage ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-slate-400">
          {preview.personalMessage}
        </p>
      ) : null}
      <button
        type="button"
        disabled={accept.isPending}
        onClick={() => accept.mutate("accept")}
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
      >
        {accept.isPending ? "Joining…" : "Accept invite"}
      </button>
      <button
        type="button"
        disabled={accept.isPending}
        onClick={() => accept.mutate("decline")}
        className="w-full rounded-lg border border-white/15 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
      >
        Decline
      </button>
      {accept.error ? <p className="text-xs text-red-400">{(accept.error as Error).message}</p> : null}
    </div>
  );
}
