"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";

export default function FestivalJoinPage() {
  const params = useParams();
  const token = String(params.token);
  const { data: session, status } = useSession();
  const [error, setError] = useState("");

  const joinPath = `/festival/join/${token}`;
  const signInHref = `/auth/creator/signin?callbackUrl=${encodeURIComponent(joinPath)}`;
  const signUpHref = `/auth/creator/signup?callbackUrl=${encodeURIComponent(joinPath)}`;

  const { data: preview } = useQuery({
    queryKey: ["festival-invite-preview", token],
    queryFn: () => fetch(`/api/festival/invites/preview?token=${encodeURIComponent(token)}`).then((r) => r.json()),
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/festival/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not accept");
      return json;
    },
    onSuccess: (json) => {
      window.location.href = json.redirectTo || "/festival";
    },
    onError: (e: Error) => setError(e.message),
  });

  const expired = Boolean(preview?.expired) || preview?.status === "EXPIRED";
  const pending = preview?.status === "PENDING" && !expired;
  const invitedEmail = preview?.emailNorm as string | undefined;
  const hasAccount = Boolean(preview?.hasExistingAccount);
  const signedInEmail = session?.user?.email?.toLowerCase() ?? "";
  const emailMismatch = Boolean(
    signedInEmail && invitedEmail && signedInEmail !== invitedEmail.toLowerCase(),
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="font-display text-xl font-semibold">Festival team invite</h1>
        {preview?.festival ? (
          <p className="mt-2 text-sm text-slate-400">
            Join <span className="text-white">{preview.festival.name}</span> as{" "}
            {String(preview.role ?? "").replace(/_/g, " ").toLowerCase()}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Loading invite…</p>
        )}

        {invitedEmail ? (
          <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
            Invited email: <span className="text-slate-200">{invitedEmail}</span>
          </p>
        ) : null}

        {expired ? (
          <p className="mt-6 text-sm text-amber-300">This invite has expired. Ask the festival admin to send a new one.</p>
        ) : null}

        {!expired && preview?.status && preview.status !== "PENDING" ? (
          <p className="mt-6 text-sm text-slate-400">
            This invite is {String(preview.status).toLowerCase()}.
          </p>
        ) : null}

        {status === "unauthenticated" && pending ? (
          <div className="mt-6 space-y-3">
            {hasAccount ? (
              <>
                <p className="text-sm text-slate-400">
                  You already have a Story Time account. Sign in with your usual details to accept.
                </p>
                <a
                  href={signInHref}
                  className="flex w-full items-center justify-center rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950"
                >
                  Sign in to accept
                </a>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  Create a Story Time account with the invited email, then you’ll return here to accept.
                </p>
                <a
                  href={signUpHref}
                  className="flex w-full items-center justify-center rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950"
                >
                  Create account & join
                </a>
                <a
                  href={signInHref}
                  className="flex w-full items-center justify-center rounded-lg border border-white/15 py-2.5 text-sm font-medium text-slate-200"
                >
                  I already have an account — sign in
                </a>
              </>
            )}
          </div>
        ) : null}

        {status === "authenticated" && pending ? (
          <div className="mt-6 space-y-3">
            {emailMismatch ? (
              <p className="text-sm text-amber-300">
                You’re signed in as {session?.user?.email}, but this invite is for {invitedEmail}. Sign out and use
                the invited email, or ask for a new invite.
              </p>
            ) : (
              <button
                type="button"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
                className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {accept.isPending ? "Joining…" : "Accept invite"}
              </button>
            )}
          </div>
        ) : null}

        {session?.user?.email ? (
          <p className="mt-3 text-xs text-slate-500">Signed in as {session.user.email}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        <Link href="/auth/creator/signin" className="mt-4 inline-block text-xs text-slate-500 underline">
          Creator / festival sign-in
        </Link>
      </div>
    </div>
  );
}
