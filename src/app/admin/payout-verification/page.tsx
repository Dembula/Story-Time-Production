"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VerificationReviewPanel } from "@/components/admin/verification-review-panel";

export default function AdminPayoutVerificationPage() {
  const [noteByProfile, setNoteByProfile] = useState<Record<string, string>>({});
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payout-kyc"],
    queryFn: async () => fetch("/api/admin/payout-kyc").then((r) => r.json()),
  });
  const review = useMutation({
    mutationFn: async (payload: { payoutKycProfileId: string; status: "UNDER_REVIEW" | "APPROVED" | "REJECTED"; note?: string }) =>
      fetch("/api/admin/payout-kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payout-kyc"] }),
  });
  const profiles = data?.profiles ?? [];
  const selectedProfile =
    profiles.find((p: { id: string }) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  return (
    <div className="space-y-6 text-slate-100">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Compliance</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Payout KYC / KYB review
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Review full identity and banking details (including account numbers and branch codes), preview bank statements
          and confirmation letters, then approve or reject payout access.
        </p>
      </header>
      {isLoading && <p className="text-sm text-slate-400">Loading submissions...</p>}
      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-3">
          {profiles.map(
            (profile: {
              id: string;
              legalName?: string;
              user?: { email?: string };
              verificationStatus?: string;
              reviewSummary?: { pendingCount?: number };
              payoutBanking?: { accountNumber?: string | null };
            }) => (
              <button
                type="button"
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedProfile?.id === profile.id
                    ? "border-orange-500/50 bg-orange-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/16"
                }`}
              >
                <p className="text-sm font-semibold text-white">{profile.legalName || "Unnamed"}</p>
                <p className="text-xs text-slate-400">{profile.user?.email}</p>
                <p className="mt-1 text-xs text-orange-300">Status: {profile.verificationStatus}</p>
                <p className="text-[11px] text-slate-500">
                  {profile.reviewSummary?.pendingCount ?? 0} pending documents
                  {profile.payoutBanking?.accountNumber
                    ? ` · Acct …${String(profile.payoutBanking.accountNumber).slice(-4)}`
                    : ""}
                </p>
              </button>
            ),
          )}
        </div>
        {selectedProfile ? (
          <VerificationReviewPanel
            profile={selectedProfile}
            note={noteByProfile[selectedProfile.id] ?? ""}
            onNoteChange={(value) => setNoteByProfile((s) => ({ ...s, [selectedProfile.id]: value }))}
            onUnderReview={() => review.mutate({ payoutKycProfileId: selectedProfile.id, status: "UNDER_REVIEW" })}
            onApprove={() =>
              review.mutate({
                payoutKycProfileId: selectedProfile.id,
                status: "APPROVED",
                note: noteByProfile[selectedProfile.id],
              })
            }
            onReject={() =>
              review.mutate({
                payoutKycProfileId: selectedProfile.id,
                status: "REJECTED",
                note: noteByProfile[selectedProfile.id] || "Documentation incomplete or could not be verified.",
              })
            }
            busy={review.isPending}
            signedUrlPath="/api/payout-kyc/documents/signed-url"
            approveLabel="Approve payouts"
            syncedBanking={selectedProfile.payoutBanking}
          />
        ) : (
          <p className="text-sm text-slate-500">Select a submission to review.</p>
        )}
      </div>
    </div>
  );
}
