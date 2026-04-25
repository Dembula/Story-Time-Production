"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Building2, ArrowLeft, Shield } from "lucide-react";
import { CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";

function BackLink() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const href =
    role === "ADMIN"
      ? "/admin"
      : role === "MUSIC_CREATOR"
        ? "/music-creator/dashboard"
        : "/creator/command-center";
  const label =
    role === "ADMIN"
      ? "Back to Admin"
      : role === "MUSIC_CREATOR"
        ? "Back to Music dashboard"
        : "Back to Command Center";
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" /> {label}
    </Link>
  );
}

type CompanyPayload = {
  companies: {
    id: string;
    displayName: string;
    seatCap: number;
    profiles: {
      id: string;
      displayName: string;
      kind: string;
      userId: string;
      pipelineDisabledByAdmin: boolean;
      user: { id: string; email: string | null; name: string | null };
    }[];
  }[];
};

export function CompanyAdminClient() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["creator-studio-company-admin"],
    queryFn: async (): Promise<CompanyPayload> => {
      const r = await fetch("/api/creator/studio-company");
      if (!r.ok) throw new Error("Failed to load company");
      return r.json() as Promise<CompanyPayload>;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ profileId, disabled }: { profileId: string; disabled: boolean }) => {
      const res = await fetch(`/api/creator/studio-company/members/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineDisabledByAdmin: disabled }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Update failed");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["creator-studio-company-admin"] });
      void queryClient.invalidateQueries({ queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{(error as Error).message}</p>;
  }

  const companies = data?.companies ?? [];
  if (companies.length === 0) {
    return (
      <div className="storytime-plan-card p-6 text-sm text-slate-400">
        You do not own a studio company workspace yet. Register as a company / team creator, or contact support.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {companies.map((c) => (
        <section key={c.id} className="storytime-plan-card p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">{c.displayName}</h2>
                <p className="text-xs text-slate-500">Seat cap: {c.seatCap} (including admin)</p>
              </div>
            </div>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Pipeline access for each profile can be restricted below (overrides package for that workspace). Invites and
            approvals will follow in a later release.
          </p>
          <ul className="space-y-2">
            {c.profiles.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-white">{p.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {p.user.email ?? p.userId} · {p.kind}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <Shield className="h-3.5 w-3.5 text-slate-500" />
                  <span>Pipeline off</span>
                  <input
                    type="checkbox"
                    checked={p.pipelineDisabledByAdmin}
                    disabled={mutation.isPending}
                    onChange={(e) =>
                      mutation.mutate({ profileId: p.id, disabled: e.target.checked })
                    }
                    className="rounded border-white/20"
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function CompanyAdminHeader() {
  return (
    <div className="mb-6">
      <BackLink />
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Studio</p>
        <h1 className="font-display text-2xl font-semibold text-white md:text-3xl">Company admin</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage team profiles under your studio company and pipeline restrictions.
        </p>
      </header>
    </div>
  );
}
