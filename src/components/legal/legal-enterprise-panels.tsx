"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SUPPORTED_JURISDICTIONS } from "@/lib/contract-template-catalog";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";

type Props = { projectId: string; contractId?: string | null };

export function LegalAnalyticsPanel({ projectId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["legal-analytics", projectId],
    queryFn: projectToolQueryFn<{ analytics: Record<string, unknown> }>(`/api/creator/projects/${projectId}/legal-analytics`),
  });
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const a = data?.analytics as {
    total?: number;
    signed?: number;
    overdue?: number;
    avgCycleDays?: number | null;
    pendingApprovals?: number;
    pendingSignatures?: number;
    rejectionRate?: number;
    blockingSchedule?: number;
  } | undefined;
  if (!a) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["Total contracts", a.total],
        ["Executed", a.signed],
        ["Overdue", a.overdue],
        ["Avg cycle (days)", a.avgCycleDays ?? "—"],
        ["Pending approvals", a.pendingApprovals],
        ["Pending signatures", a.pendingSignatures],
        ["Rejection rate", `${Math.round(Number(a.rejectionRate ?? 0) * 100)}%`],
        ["Blocking schedule", a.blockingSchedule],
      ].map(([label, value]) => (
        <div key={String(label)} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-semibold text-white">{String(value)}</p>
        </div>
      ))}
    </div>
  );
}

export function ClauseLibraryPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [jurisdiction, setJurisdiction] = useState("South Africa");
  const { data, isLoading } = useQuery({
    queryKey: ["contract-clauses", projectId, jurisdiction],
    queryFn: projectToolQueryFn<{
      clauses: Array<{ id: string; title: string; category: string; jurisdiction: string | null; body: string }>;
      samplePack: { governingLaw: string; jurisdictionCourts: string; popiaClause: string; mandatoryClauses: string[] };
    }>(`/api/creator/projects/${projectId}/contracts/clauses?jurisdiction=${encodeURIComponent(jurisdiction)}`),
  });

  const createMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/contracts/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, jurisdiction, category: "custom" }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-clauses", projectId] });
      setTitle("");
      setBody("");
    },
  });

  const seedMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/contracts/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_defaults" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-clauses", projectId] }),
  });

  const seedJurisdictionMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/contracts/clauses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_jurisdiction_packs" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-clauses", projectId] }),
  });

  const pack = data?.samplePack;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clause title" className="max-w-xs" />
        <select
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className="h-10 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm"
        >
          {SUPPORTED_JURISDICTIONS.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => seedMut.mutate()}>
          Seed defaults
        </Button>
        <Button size="sm" variant="outline" onClick={() => seedJurisdictionMut.mutate()}>
          Seed jurisdiction packs
        </Button>
      </div>
      {pack && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-xs text-slate-300">
          <p className="font-medium text-orange-200">Jurisdiction engine — {jurisdiction}</p>
          <p className="mt-1">Governing law: {pack.governingLaw}</p>
          <p>Courts: {pack.jurisdictionCourts}</p>
          <p className="mt-1 text-slate-400">{pack.popiaClause}</p>
          {pack.mandatoryClauses.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-slate-400">
              {pack.mandatoryClauses.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Clause body…"
        className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-slate-200"
      />
      <Button size="sm" disabled={!title.trim() || !body.trim()} onClick={() => createMut.mutate()}>
        Add to library
      </Button>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {(data?.clauses ?? []).map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-800 p-3 text-xs">
            <p className="font-medium text-white">
              {c.title} <span className="text-slate-500">· {c.category}</span>
            </p>
            {c.jurisdiction && <p className="text-[10px] text-orange-300/80">{c.jurisdiction}</p>}
            <p className="mt-1 whitespace-pre-wrap text-slate-400 line-clamp-4">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContractVersionDiffPanel({ projectId, contractId }: Props) {
  const [versionA, setVersionA] = useState("");
  const [versionB, setVersionB] = useState("");
  const { data: versionsData } = useQuery({
    queryKey: ["contract-versions", projectId, contractId],
    queryFn: projectToolQueryFn<{ versions: Array<{ id: string; version: number }> }>(
      `/api/creator/projects/${projectId}/contracts/${contractId}/versions`,
    ),
    enabled: !!contractId,
  });

  const { data: diffData, refetch, isFetching } = useQuery({
    queryKey: ["contract-diff", projectId, contractId, versionA, versionB],
    queryFn: projectToolQueryFn<{ diff: Array<{ kind: string; textA: string | null; textB: string | null }>; summary: Record<string, number> }>(
      `/api/creator/projects/${projectId}/contracts/${contractId}/versions?versionA=${versionA}&versionB=${versionB}`,
    ),
    enabled: false,
  });

  const versions = versionsData?.versions ?? [];
  if (!contractId) return <p className="text-sm text-slate-500">Select a contract to compare versions.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={versionA} onChange={(e) => setVersionA(e.target.value)} className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-xs">
          <option value="">Version A</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version}
            </option>
          ))}
        </select>
        <select value={versionB} onChange={(e) => setVersionB(e.target.value)} className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-xs">
          <option value="">Version B</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={!versionA || !versionB || isFetching} onClick={() => refetch()}>
          Compare
        </Button>
        <a
          href={`/api/creator/projects/${projectId}/contracts/${contractId}/export`}
          className="inline-flex h-9 items-center rounded-md border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-800"
        >
          Export PDF
        </a>
      </div>
      {diffData?.summary && (
        <p className="text-xs text-slate-400">
          +{diffData.summary.added} / −{diffData.summary.removed} / ~{diffData.summary.changed} changed lines
        </p>
      )}
      <div className="max-h-72 overflow-y-auto rounded border border-slate-800 font-mono text-[11px]">
        {(diffData?.diff ?? []).map((line, i) => (
          <div
            key={i}
            className={
              line.kind === "added" ? "bg-emerald-500/10 text-emerald-200"
              : line.kind === "removed" ? "bg-red-500/10 text-red-200"
              : line.kind === "changed" ? "bg-amber-500/10 text-amber-100"
              : "text-slate-400"
            }
          >
            {line.kind === "removed" || line.kind === "changed" ? <span className="px-2">− {line.textA}</span> : null}
            {line.kind === "added" || line.kind === "changed" ? <span className="px-2">+ {line.textB}</span> : null}
            {line.kind === "same" ? <span className="px-2 opacity-50">{line.textA}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContractApprovalsPanel({ projectId, contractId }: Props) {
  const qc = useQueryClient();
  const [approverUserId, setApproverUserId] = useState("");
  const [approverRole, setApproverRole] = useState("PRODUCER");
  const { data, isLoading } = useQuery({
    queryKey: ["contract-approvals", projectId, contractId],
    queryFn: projectToolQueryFn<{
      steps: Array<{ id: string; stepOrder: number; status: string; approverRole: string | null; approver: { id: string; name: string | null } | null }>;
      members: Array<{ userId: string; role: string; user: { id: string; name: string | null; email: string | null } }>;
    }>(`/api/creator/projects/${projectId}/contracts/${contractId}/approvals`),
    enabled: !!contractId,
  });

  const saveMut = useMutation({
    mutationFn: (steps: Array<{ approverUserId?: string; approverRole?: string }>) =>
      fetch(`/api/creator/projects/${projectId}/contracts/${contractId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-approvals", projectId, contractId] }),
  });

  const defaultChainMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/contracts/${contractId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "default_chain" }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-approvals", projectId, contractId] }),
  });

  const decideMut = useMutation({
    mutationFn: (input: { stepId: string; decision: "APPROVED" | "REJECTED" }) =>
      fetch(`/api/creator/projects/${projectId}/contracts/${contractId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide", ...input }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-approvals", projectId, contractId] }),
  });

  if (!contractId) return <p className="text-sm text-slate-500">Select a contract to configure approval routing.</p>;
  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <Button size="sm" variant="outline" onClick={() => defaultChainMut.mutate()}>
          Auto-build chain
        </Button>
        <select
          value={approverUserId}
          onChange={(e) => setApproverUserId(e.target.value)}
          className="h-9 max-w-xs rounded border border-slate-700 bg-slate-900 px-2 text-xs"
        >
          <option value="">Select approver…</option>
          {(data?.members ?? []).map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name ?? m.user.email ?? m.userId} · {m.role}
            </option>
          ))}
        </select>
        <select
          value={approverRole}
          onChange={(e) => setApproverRole(e.target.value)}
          className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-xs"
        >
          {["PRODUCER", "LEGAL", "FINANCE", "EXECUTIVE"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={!approverUserId}
          onClick={() =>
            saveMut.mutate([
              ...(data?.steps ?? []).map((s) => ({
                approverUserId: s.approver?.id,
                approverRole: s.approverRole ?? "PRODUCER",
              })),
              { approverUserId: approverUserId, approverRole },
            ])
          }
        >
          Add step
        </Button>
      </div>
      <ul className="space-y-1 text-xs">
        {(data?.steps ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1.5">
            <span>
              Step {s.stepOrder} · {s.approverRole ?? "Approver"} {s.approver?.name ? `(${s.approver.name})` : ""}
            </span>
            <div className="flex items-center gap-2">
              <span className={s.status === "APPROVED" ? "text-emerald-400" : s.status === "REJECTED" ? "text-red-400" : "text-amber-300"}>
                {s.status}
              </span>
              {s.status === "PENDING" && (
                <>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => decideMut.mutate({ stepId: s.id, decision: "APPROVED" })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => decideMut.mutate({ stepId: s.id, decision: "REJECTED" })}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContractSignersPanel({ projectId, contractId }: Props) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [signingMode, setSigningMode] = useState<"PARALLEL" | "SEQUENTIAL">("PARALLEL");
  const [resendNote, setResendNote] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["contract-signers", projectId, contractId],
    queryFn: projectToolQueryFn<{ signers: Array<{ id: string; label: string; email: string | null; signOrder: number; status: string; partyRole: string }>; signingMode: string }>(
      `/api/creator/projects/${projectId}/contracts/${contractId}/signers`,
    ),
    enabled: !!contractId,
  });

  const localSigners = useMemo(() => data?.signers ?? [], [data?.signers]);

  useEffect(() => {
    if (data?.signingMode === "SEQUENTIAL" || data?.signingMode === "PARALLEL") {
      setSigningMode(data.signingMode);
    }
  }, [data?.signingMode]);

  const saveMut = useMutation({
    mutationFn: (signers: Array<{ label: string; email?: string; partyRole: string; signOrder?: number }>) =>
      fetch(`/api/creator/projects/${projectId}/contracts/${contractId}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signers, signingMode }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-signers", projectId, contractId] });
      setLabel("");
      setEmail("");
    },
  });

  const resendMut = useMutation({
    mutationFn: () =>
      fetch(`/api/creator/projects/${projectId}/contracts/${contractId}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend_invites" }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Could not resend links");
        return json as { sent: number; total: number };
      }),
    onSuccess: (d) => setResendNote(`Sent ${d.sent} of ${d.total} link(s).`),
    onError: (e: Error) => setResendNote(e.message),
  });

  if (!contractId) return <p className="text-sm text-slate-500">Select a contract to manage signers.</p>;
  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={signingMode}
          onChange={(e) => setSigningMode(e.target.value as "PARALLEL" | "SEQUENTIAL")}
          className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-xs"
        >
          <option value="PARALLEL">Parallel signing</option>
          <option value="SEQUENTIAL">Sequential signing</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={resendMut.isPending}
          onClick={() => resendMut.mutate()}
        >
          Resend in-app response links
        </Button>
      </div>
      <p className="text-[10px] text-slate-500">
        Signers approve, decline, or request changes via in-app checkboxes — no DocuSign or other external e-sign service.
        Guest signers without accounts receive email links. Sequential mode sends one link at a time in sign order.
      </p>
      {resendNote && <p className="text-[10px] text-slate-400">{resendNote}</p>}
      <div className="flex flex-wrap gap-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Signer name" className="max-w-[140px] text-xs" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (guest)" className="max-w-[180px] text-xs" />
        <Button
          size="sm"
          disabled={!label.trim()}
          onClick={() =>
            saveMut.mutate([
              ...localSigners.map((s, i) => ({
                label: s.label,
                email: s.email ?? undefined,
                partyRole: s.partyRole,
                signOrder: signingMode === "SEQUENTIAL" ? i + 1 : 0,
              })),
              { label: label.trim(), email: email.trim() || undefined, partyRole: "COUNTERPARTY", signOrder: localSigners.length + 1 },
            ])
          }
        >
          Add signer
        </Button>
      </div>
      <ul className="space-y-1 text-xs">
        {localSigners.map((s) => (
          <li key={s.id} className="flex justify-between rounded border border-slate-800 px-2 py-1.5">
            <span>
              {signingMode === "SEQUENTIAL" ? `#${s.signOrder} ` : ""}
              {s.label} · {s.partyRole}
              {s.email ? ` · ${s.email}` : ""}
            </span>
            <span className={s.status === "SIGNED" ? "text-emerald-400" : "text-amber-300"}>{s.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type LegalEnterpriseTab = "analytics" | "clauses" | "approvals" | "signers" | "versions";

export function LegalEnterprisePanels({
  projectId,
  contractId,
  tab,
}: Props & { tab: LegalEnterpriseTab }) {
  if (tab === "analytics") return <LegalAnalyticsPanel projectId={projectId} />;
  if (tab === "clauses") return <ClauseLibraryPanel projectId={projectId} />;
  if (tab === "approvals") return <ContractApprovalsPanel projectId={projectId} contractId={contractId} />;
  if (tab === "signers") return <ContractSignersPanel projectId={projectId} contractId={contractId} />;
  return <ContractVersionDiffPanel projectId={projectId} contractId={contractId} />;
}
