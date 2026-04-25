"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Mail, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { STUDIO_SUITE_OPTIONS } from "@/lib/creator-team-invites";
import { CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";

type InviteRow = {
  id: string;
  companyId: string;
  companyName: string;
  emailNorm: string;
  status: string;
  suiteAccess: unknown;
  token: string;
  expiresAt: string;
};

type CompanyOption = { id: string; displayName: string; seatCap: number };

export function CompanyAccountControlClient() {
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [suites, setSuites] = useState<string[]>(["pipeline_pre", "pipeline_prod", "pipeline_post", "catalogue_upload"]);
  const [feedback, setFeedback] = useState<{ ok?: string; err?: string }>({});

  const { data: studio } = useQuery({
    queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY],
    queryFn: async () => {
      const r = await fetch("/api/creator/studio-profiles");
      if (!r.ok) throw new Error("Failed to load studio");
      return r.json() as Promise<{ companies: CompanyOption[] }>;
    },
  });

  const companies = studio?.companies ?? [];
  const selectedCompany = companies.find((c) => c.id === companyId) ?? companies[0];

  useEffect(() => {
    if (!companyId && companies[0]?.id) setCompanyId(companies[0].id);
  }, [companyId, companies]);

  const { data: invitesData, isLoading } = useQuery({
    queryKey: ["studio-company-invites"],
    queryFn: async () => {
      const r = await fetch("/api/creator/studio-company/invites");
      if (!r.ok) throw new Error("Failed to load invites");
      return r.json() as Promise<{ invites: InviteRow[] }>;
    },
    enabled: companies.length > 0,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const cid = companyId || companies[0]?.id;
      if (!cid) throw new Error("No company");
      const res = await fetch("/api/creator/studio-company/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: cid,
          email,
          suiteAccess: suites,
          personalMessage: message || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Invite failed");
      return j as { registeredOnPlatform: boolean; joinUrl?: string; message?: string };
    },
    onSuccess: (j) => {
      setFeedback({
        ok: j.message ?? (j.registeredOnPlatform ? "Invite sent (notification)." : "Invite created. Share the join link."),
      });
      setEmail("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["studio-company-invites"] });
    },
    onError: (e: Error) => setFeedback({ err: e.message }),
  });

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const cancelInvite = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/creator/studio-company/invites/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFeedback({ err: typeof j.error === "string" ? j.error : "Could not cancel" });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["studio-company-invites"] });
    },
    [queryClient],
  );

  if (companies.length === 0) {
    return (
      <div className="storytime-plan-card p-6 text-sm text-slate-400">
        You need a studio company workspace to use account control.{" "}
        <Link href="/auth/creator/signup" className="text-orange-300 hover:underline">
          Register as a company creator
        </Link>{" "}
        or open{" "}
        <Link href="/creator/company" className="text-orange-300 hover:underline">
          Company admin
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="storytime-plan-card p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-white/8 pb-3">
          <Users className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Invite team members</h2>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Enter an email. If they already have a Story Time account, they get a notification. If not, share the join
          link — they must sign up with the same email, then open the link to complete onboarding for this company.
        </p>
        {companies.length > 1 ? (
          <label className="mb-3 block text-xs text-slate-400">
            Company
            <select
              value={companyId || companies[0].id}
              onChange={(e) => setCompanyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} · seats {c.seatCap}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="mb-3 block text-xs text-slate-400">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
            placeholder="teammate@example.com"
          />
        </label>
        <fieldset className="mb-3">
          <legend className="mb-2 text-xs font-medium text-slate-400">Suite access</legend>
          <div className="flex flex-col gap-2">
            {STUDIO_SUITE_OPTIONS.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={suites.includes(s.id)}
                  onChange={(e) => {
                    setSuites((prev) =>
                      e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                    );
                  }}
                  className="rounded border-white/20"
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mb-3 block text-xs text-slate-400">
          Optional message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        {feedback.ok ? <p className="mb-2 text-xs text-emerald-400">{feedback.ok}</p> : null}
        {feedback.err ? <p className="mb-2 text-xs text-red-400">{feedback.err}</p> : null}
        <button
          type="button"
          disabled={inviteMutation.isPending || !email.trim()}
          onClick={() => {
            setFeedback({});
            inviteMutation.mutate();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Send invite
        </button>
      </section>

      <section className="storytime-plan-card p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-white/8 pb-3">
          <Mail className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Pending invites</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {(invitesData?.invites ?? [])
              .filter((i) => i.status === "PENDING")
              .map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-white">{i.emailNorm}</p>
                    <p className="text-xs text-slate-500">
                      {i.companyName} · expires {new Date(i.expiresAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1 break-all text-[10px] text-slate-600">
                      Join link: {origin ? `${origin}/creator/join/company/${i.token}` : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void cancelInvite(i.id)}
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" /> Cancel
                  </button>
                </li>
              ))}
            {(invitesData?.invites ?? []).filter((i) => i.status === "PENDING").length === 0 ? (
              <p className="text-sm text-slate-500">No pending invites.</p>
            ) : null}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-slate-600">
        <Building2 className="mr-1 inline h-3 w-3" />
        Seat cap for {selectedCompany?.displayName ?? "company"}: {selectedCompany?.seatCap ?? "—"}
      </p>
    </div>
  );
}
