"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalEmptyPanel } from "@/components/festival/festival-empty-panel";
import { FestivalScopeSelect } from "@/components/festival/festival-scope-select";
import { useActiveFestival } from "@/components/festival/use-active-festival";

export default function FestivalTeamPage() {
  const { festivals, activeId, setActiveFestivalId, isLoading: listLoading } = useActiveFestival();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAGE1_REVIEWER");
  const [joinUrl, setJoinUrl] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["festival-team", activeId],
    queryFn: () => fetch(`/api/festival/${activeId}/invites`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const members = data?.members ?? [];
  const pending = (data?.invites ?? []).filter((i: { status: string }) => i.status === "PENDING");

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
    <div className="mx-auto max-w-5xl space-y-8">
      <OpsPageHeader title="Team" subtitle="Invite Stage 1 / Stage 2 reviewers and festival admins." />

      <FestivalScopeSelect
        festivals={festivals}
        value={activeId}
        onChange={setActiveFestivalId}
        isLoading={listLoading}
      />

      {!activeId ? (
        <FestivalEmptyPanel
          icon={Users}
          title="Select a festival"
          actionHref="/festival/festivals"
          actionLabel="My festivals"
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <OpsMetricCard label="Members" value={members.length} accent="orange" />
            <OpsMetricCard label="Pending invites" value={pending.length} accent="amber" />
          </div>

          <OpsSection title="Invite reviewer">
            <form
              className="cinematic-glass grid gap-3 rounded-2xl border border-white/8 p-5 shadow-panel sm:grid-cols-[1fr_12rem_auto]"
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
                className="h-11 rounded-xl border border-white/12 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400/50"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-11 rounded-xl border border-white/12 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400/50"
              >
                <option value="STAGE1_REVIEWER">Stage 1 reviewer</option>
                <option value="STAGE2_REVIEWER">Stage 2 reviewer</option>
                <option value="ADMIN">Festival admin</option>
              </select>
              <button
                type="submit"
                className="h-11 rounded-xl bg-orange-500/90 px-4 text-sm font-semibold text-slate-950"
              >
                Send invite
              </button>
              {error ? <p className="text-sm text-red-400 sm:col-span-3">{error}</p> : null}
              {joinUrl ? (
                <p className="break-all text-xs text-emerald-300 sm:col-span-3">Invite link: {joinUrl}</p>
              ) : null}
            </form>
          </OpsSection>

          <OpsSection title="Members">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : members.length === 0 ? (
              <FestivalEmptyPanel icon={Users} title="No members yet" />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Person</th>
                      <th className="px-4 py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m: {
                      id: string;
                      role: string;
                      user: { name: string | null; email: string | null };
                    }) => (
                      <tr key={m.id} className="border-t border-white/8">
                        <td className="px-4 py-3 text-white">
                          {m.user.name || m.user.email}
                          <div className="text-[11px] text-slate-600">{m.user.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{m.role.replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsSection>

          <OpsSection title="Pending invites">
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500">No pending invites.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((i: { id: string; emailNorm: string; role: string }) => (
                      <tr key={i.id} className="border-t border-white/8">
                        <td className="px-4 py-3 text-slate-300">{i.emailNorm}</td>
                        <td className="px-4 py-3 text-slate-500">{i.role.replace(/_/g, " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsSection>
        </>
      )}
    </div>
  );
}
