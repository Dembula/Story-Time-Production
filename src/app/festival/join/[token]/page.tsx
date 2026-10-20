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

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <h1 className="font-display text-xl font-semibold">Festival team invite</h1>
        {preview?.festival ? (
          <p className="mt-2 text-sm text-slate-400">
            Join <span className="text-white">{preview.festival.name}</span> as {preview.role?.replace(/_/g, " ")}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Loading invite…</p>
        )}

        {status === "unauthenticated" ? (
          <button
            type="button"
            className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950"
            onClick={() => {
              window.location.href = `/auth/creator/signin?callbackUrl=${encodeURIComponent(`/festival/join/${token}`)}`;
            }}
          >
            Sign in to accept
          </button>
        ) : (
          <button
            type="button"
            disabled={accept.isPending || preview?.expired || preview?.status !== "PENDING"}
            onClick={() => accept.mutate()}
            className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {accept.isPending ? "Joining…" : "Accept invite"}
          </button>
        )}

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
