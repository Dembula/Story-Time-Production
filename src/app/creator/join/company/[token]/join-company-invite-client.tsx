"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";

type Preview = { valid: boolean; companyName?: string; expired?: boolean; status?: string; error?: string };

export function JoinCompanyInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [inviteList, setInviteList] = useState<{ id: string; companyName: string }[] | null>(null);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["team-invite-preview", token],
    queryFn: async () => {
      const r = await fetch(`/api/creator/team-invites/preview?token=${encodeURIComponent(token)}`);
      const j = (await r.json().catch(() => ({}))) as Preview & Record<string, unknown>;
      if (!r.ok) return { valid: false, error: typeof j.error === "string" ? j.error : "Invalid link" };
      return j as Preview;
    },
  });

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.email) return;
    void fetch("/api/creator/team-invites")
      .then((r) => r.json())
      .then((d: { invites?: { id: string; companyName: string; token: string }[] }) => {
        const list = (d.invites ?? []).filter((i) => i.token === token);
        setInviteList(list.map((i) => ({ id: i.id, companyName: i.companyName })));
      })
      .catch(() => setInviteList([]));
  }, [status, session?.user?.email, token]);

  const accept = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/creator/team-invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not accept");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY] });
      router.push("/creator/command-center");
      router.refresh();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
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
          href={`/auth/signin?callbackUrl=${encodeURIComponent(`/creator/join/company/${token}`)}`}
          className="inline-block rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-400"
        >
          Sign in
        </Link>
        <p className="text-xs text-slate-500">
          New to Story Time?{" "}
          <Link href={`/auth/creator/signup?callbackUrl=${encodeURIComponent(`/creator/join/company/${token}`)}`} className="text-orange-300 hover:underline">
            Create an account
          </Link>{" "}
          using the same email the owner invited.
        </p>
      </div>
    );
  }

  const match = inviteList?.[0];
  if (inviteList && inviteList.length === 0) {
    return (
      <p className="text-center text-sm text-amber-400">
        This invite is tied to a different email than the one you are signed in with. Sign out and sign in with the
        invited address, or ask the studio owner to send a new invite to{" "}
        <span className="font-medium text-slate-200">{session?.user?.email}</span>.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <h1 className="font-display text-2xl font-semibold text-white">Join {preview.companyName}</h1>
      <p className="text-sm text-slate-400">Accepting creates a company workspace profile under this studio.</p>
      {match ? (
        <button
          type="button"
          disabled={accept.isPending}
          onClick={() => accept.mutate(match.id)}
          className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
        >
          {accept.isPending ? "Joining…" : "Accept invite"}
        </button>
      ) : (
        <p className="text-xs text-slate-500">Checking invite for your account…</p>
      )}
      {accept.error ? <p className="text-xs text-red-400">{(accept.error as Error).message}</p> : null}
    </div>
  );
}
