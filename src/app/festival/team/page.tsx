"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function FestivalTeamPage() {
  const [festivalId, setFestivalId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAGE1_REVIEWER");
  const [joinUrl, setJoinUrl] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const { data: list } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });
  const festivals = list?.festivals ?? [];
  const activeId = festivalId || festivals[0]?.id || "";

  const { data } = useQuery({
    queryKey: ["festival-team", activeId],
    queryFn: () => fetch(`/api/festival/${activeId}/invites`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/festival/${activeId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
      return json;
    },
    onSuccess: (json) => {
      setJoinUrl(json.joinUrl || "");
      setEmail("");
      setError("");
      qc.invalidateQueries({ queryKey: ["festival-team", activeId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Team</h1>
        <p className="mt-1 text-sm text-slate-400">
          Invite Stage 1 and Stage 2 reviewers by email. They join via a secure link.
        </p>
      </div>

      <select
        value={activeId}
        onChange={(e) => setFestivalId(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
      >
        {festivals.map((f: { id: string; name: string }) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>

      <form
        className="space-y-3 rounded-2xl border border-slate-800 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          invite.mutate();
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="reviewer@email.com"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="STAGE1_REVIEWER">Stage 1 reviewer</option>
          <option value="STAGE2_REVIEWER">Stage 2 reviewer</option>
          <option value="ADMIN">Festival admin</option>
        </select>
        <button type="submit" className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950">
          Send invite
        </button>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {joinUrl ? (
          <p className="break-all text-xs text-emerald-300">Invite link: {joinUrl}</p>
        ) : null}
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Members</h2>
        <ul className="space-y-2">
          {(data?.members ?? []).map((m: { id: string; role: string; user: { name: string | null; email: string | null } }) => (
            <li key={m.id} className="flex justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <span className="text-white">{m.user.name || m.user.email}</span>
              <span className="text-slate-500">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Pending invites</h2>
        <ul className="space-y-2">
          {(data?.invites ?? [])
            .filter((i: { status: string }) => i.status === "PENDING")
            .map((i: { id: string; emailNorm: string; role: string }) => (
              <li key={i.id} className="flex justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
                <span>{i.emailNorm}</span>
                <span className="text-slate-500">{i.role}</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
