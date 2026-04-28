"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function CompanyFundingListingsPage() {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [fundingTarget, setFundingTarget] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");

  const { data } = useQuery({
    queryKey: ["company-funding-listings"],
    queryFn: async () => fetch("/api/creator/company-funding-listings").then((r) => r.json()),
  });
  const create = useMutation({
    mutationFn: async () =>
      fetch("/api/creator/company-funding-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          title,
          fundingTarget: Number(fundingTarget || "0"),
          useOfFunds,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-funding-listings"] });
      setTitle("");
      setFundingTarget("");
      setUseOfFunds("");
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-semibold">Company Funding Listings</h1>
      <p className="mt-2 text-sm text-slate-400">
        List expansion opportunities (equipment growth, facilities, staffing, operations) for funders.
      </p>
      <div className="mt-6 grid gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2">
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Listing title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Funding target (ZAR)" value={fundingTarget} onChange={(e) => setFundingTarget(e.target.value)} />
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Use of funds" value={useOfFunds} onChange={(e) => setUseOfFunds(e.target.value)} />
        <button className="md:col-span-2 rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-black" onClick={() => create.mutate()}>
          Publish company listing
        </button>
      </div>
      <div className="mt-6 space-y-2">
        {(data?.listings ?? []).map((listing: any) => (
          <div key={listing.id} className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
            <p className="font-semibold text-white">{listing.opportunity?.title}</p>
            <p className="text-xs text-slate-400">
              Target: R{Number(listing.opportunity?.fundingTarget ?? 0).toLocaleString()} · Status: {listing.opportunity?.status}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
