"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function FunderDealsPage() {
  const qc = useQueryClient();
  const [messageByDeal, setMessageByDeal] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ["funder-deals"],
    queryFn: async () => fetch("/api/funders/deals").then((r) => r.json()),
  });
  const mutate = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      fetch("/api/funders/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funder-deals"] }),
  });
  const deals = data?.deals ?? [];

  return (
    <main className="space-y-5 text-slate-100">
      <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-panel">
        <h1 className="text-2xl font-semibold">Deal Engine</h1>
        <p className="mt-1 text-sm text-slate-400">
          Run deals end-to-end: negotiation, term sheets, contracts, signatures, and payment milestones.
        </p>
      </section>

      <div className="space-y-3">
        {deals.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-400">
            No active deals yet. Start by expressing interest from the Opportunities page.
          </div>
        ) : null}
        {deals.map((deal: any) => (
          <div key={deal.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{deal.opportunity?.title ?? "Untitled opportunity"}</h2>
                <p className="text-xs text-slate-400">Status: {deal.pipelineStatus}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-white/[0.05]" onClick={() => mutate.mutate({ action: "DECIDE_DEAL", dealId: deal.id, status: "FUNDED" })}>
                  Accept & fund
                </button>
                <button className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-900/20" onClick={() => mutate.mutate({ action: "DECIDE_DEAL", dealId: deal.id, status: "REJECTED", rejectionReason: "Risk profile mismatch." })}>
                  Reject
                </button>
                <button className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-white/[0.05]" onClick={() => mutate.mutate({ action: "GENERATE_CONTRACT", dealId: deal.id })}>
                  Generate contract
                </button>
                <button className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-white/[0.05]" onClick={() => mutate.mutate({ action: "SIGN_CONTRACT", dealId: deal.id })}>
                  Sign
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={messageByDeal[deal.id] ?? ""}
                onChange={(e) => setMessageByDeal((prev) => ({ ...prev, [deal.id]: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Discuss terms with creator..."
              />
              <button
                className="rounded bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
                onClick={() => mutate.mutate({ action: "SEND_MESSAGE", dealId: deal.id, message: messageByDeal[deal.id] || "Term discussion started." })}
              >
                Send
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
