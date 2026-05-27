"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VerificationReviewPanel } from "@/components/admin/verification-review-panel";

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
  const profiles = data?.profiles ?? [];
  const selectedProfile =
    profiles.find((p: { id: string }) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  return (
    <div className="space-y-4 text-slate-100">
      <h1 className="text-2xl font-semibold">Funders verification review</h1>
      <p className="text-sm text-slate-400">Review funder identity submissions before unlocking deal participation.</p>
      {isLoading && <p className="text-sm text-slate-400">Loading funders...</p>}
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-3">
          {profiles.map((profile: { id: string; legalName?: string; user?: { email?: string }; verificationStatus?: string; reviewSummary?: { pendingCount?: number } }) => (
            <button
              type="button"
              key={profile.id}
              onClick={() => setSelectedProfileId(profile.id)}
              className={`w-full rounded-lg border p-4 text-left ${selectedProfile?.id === profile.id ? "border-orange-500 bg-slate-900" : "border-slate-800 bg-slate-950/60"}`}
            >
              <p className="text-sm font-semibold text-white">{profile.legalName || "Unnamed funder"}</p>
              <p className="text-xs text-slate-400">{profile.user?.email}</p>
              <p className="mt-1 text-xs text-orange-300">Status: {profile.verificationStatus}</p>
              <p className="text-[11px] text-slate-500">{profile.reviewSummary?.pendingCount ?? 0} pending documents</p>
            </button>
          ))}
        </div>
        {selectedProfile ? (
          <VerificationReviewPanel
            profile={selectedProfile}
            note={noteByProfile[selectedProfile.id] ?? ""}
            onNoteChange={(value) => setNoteByProfile((s) => ({ ...s, [selectedProfile.id]: value }))}
            onUnderReview={() => review.mutate({ funderProfileId: selectedProfile.id, status: "UNDER_REVIEW" })}
            onApprove={() =>
              review.mutate({
                funderProfileId: selectedProfile.id,
                status: "APPROVED",
                note: noteByProfile[selectedProfile.id],
              })
            }
            onReject={() =>
              review.mutate({
                funderProfileId: selectedProfile.id,
                status: "REJECTED",
                note: noteByProfile[selectedProfile.id] || "Document checks incomplete.",
              })
            }
            busy={review.isPending}
            signedUrlPath="/api/funders/documents/signed-url"
            approveLabel="Approve investing"
          />
        ) : (
          <p className="text-sm text-slate-500">Select a funder to review.</p>
        )}
      </div>
    </div>
  );
}
