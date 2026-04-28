"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function AdminFundersPage() {
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

  return (
    <div className="space-y-4 text-slate-100">
      <h1 className="text-2xl font-semibold">Funders Verification Review</h1>
      {isLoading && <p className="text-sm text-slate-400">Loading funders...</p>}
      <div className="space-y-3">
        {(data?.profiles ?? []).map((profile: any) => (
          <div key={profile.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{profile.legalName || profile.user?.name || "Unnamed funder"}</p>
                <p className="text-xs text-slate-400">{profile.user?.email}</p>
                <p className="mt-1 text-xs text-orange-300">Status: {profile.verificationStatus}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => review.mutate({ funderProfileId: profile.id, status: "UNDER_REVIEW" })}>
                  Under review
                </button>
                <button className="rounded border border-emerald-900 px-2 py-1 text-xs text-emerald-300" onClick={() => review.mutate({ funderProfileId: profile.id, status: "APPROVED" })}>
                  Approve
                </button>
                <button className="rounded border border-red-900 px-2 py-1 text-xs text-red-300" onClick={() => review.mutate({ funderProfileId: profile.id, status: "REJECTED", note: "Document checks incomplete." })}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
