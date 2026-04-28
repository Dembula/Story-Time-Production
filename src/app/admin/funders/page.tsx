"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function AdminFundersPage() {
  const [noteByProfile, setNoteByProfile] = useState<Record<string, string>>({});
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-funders"],
    queryFn: async () => fetch("/api/admin/funders").then((r) => r.json()),
  });
  const review = useMutation({
    mutationFn: async (payload: { funderProfileId: string; status: "UNDER_REVIEW" | "APPROVED" | "REJECTED"; note?: string }) =>
      fetch("/api/admin/funders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-funders"] }),
  });
  const selectedProfile = (data?.profiles ?? []).find((p: any) => p.id === selectedProfileId) ?? (data?.profiles ?? [])[0];

  async function openPrivateDocument(verificationId: string) {
    const res = await fetch(`/api/funders/documents/signed-url?verificationId=${encodeURIComponent(verificationId)}`);
    const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !j.url) {
      alert(j.error || "Could not open document");
      return;
    }
    window.open(j.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4 text-slate-100">
      <h1 className="text-2xl font-semibold">Funders Verification Review</h1>
      {isLoading && <p className="text-sm text-slate-400">Loading funders...</p>}
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-3">
        {(data?.profiles ?? []).map((profile: any) => (
          <button
            type="button"
            key={profile.id}
            onClick={() => setSelectedProfileId(profile.id)}
            className={`w-full rounded-lg border p-4 text-left ${selectedProfile?.id === profile.id ? "border-orange-500 bg-slate-900" : "border-slate-800 bg-slate-950/60"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{profile.legalName || profile.user?.name || "Unnamed funder"}</p>
                <p className="text-xs text-slate-400">{profile.user?.email}</p>
                <p className="mt-1 text-xs text-orange-300">Status: {profile.verificationStatus}</p>
                <p className="text-xs text-slate-400">Risk: {profile.riskLevel ?? "LOW"}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Docs {profile.reviewSummary?.approvedCount ?? 0} approved · {profile.reviewSummary?.pendingCount ?? 0} pending
                </p>
              </div>
            </div>
          </button>
        ))}
        </div>
        {selectedProfile ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-white">{selectedProfile.legalName || selectedProfile.user?.name || "Unnamed funder"}</p>
                <p className="text-xs text-slate-400">{selectedProfile.user?.email}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => review.mutate({ funderProfileId: selectedProfile.id, status: "UNDER_REVIEW" })}>Under review</button>
                <button className="rounded border border-emerald-900 px-2 py-1 text-xs text-emerald-300" onClick={() => review.mutate({ funderProfileId: selectedProfile.id, status: "APPROVED", note: noteByProfile[selectedProfile.id] })}>Approve</button>
                <button className="rounded border border-red-900 px-2 py-1 text-xs text-red-300" onClick={() => review.mutate({ funderProfileId: selectedProfile.id, status: "REJECTED", note: noteByProfile[selectedProfile.id] || "Document checks incomplete." })}>Reject</button>
              </div>
            </div>

            <textarea
              value={noteByProfile[selectedProfile.id] ?? ""}
              onChange={(e) => setNoteByProfile((s) => ({ ...s, [selectedProfile.id]: e.target.value }))}
              placeholder="Admin notes / rejection reason"
              rows={2}
              className="mt-3 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
            />
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {(selectedProfile.verifications ?? []).map((doc: any) => (
                <button
                  type="button"
                  key={doc.id}
                  onClick={() => void openPrivateDocument(doc.id)}
                  className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900"
                >
                  {doc.documentType} · {doc.status}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
