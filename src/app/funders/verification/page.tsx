"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function FunderVerificationPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["funder-verification"],
    queryFn: async () => fetch("/api/funders/verification").then((r) => r.json()),
  });
  const [legalName, setLegalName] = useState("");
  const [entityType, setEntityType] = useState("INDIVIDUAL");
  const [investmentThesis, setInvestmentThesis] = useState("");
  const [docType, setDocType] = useState("GOVERNMENT_ID");
  const [docUrl, setDocUrl] = useState("");

  const submit = useMutation({
    mutationFn: async () =>
      fetch("/api/funders/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          entityType,
          investmentThesis,
          documents: [{ documentType: docType, documentUrl: docUrl }],
        }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funder-verification"] }),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-semibold">Funder Registration & Verification</h1>
      <p className="mt-2 text-sm text-slate-400">
        Complete your KYC profile. You can browse opportunities before approval, but deals/contracts/payments unlock after admin approval.
      </p>

      <div className="mt-6 grid gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2">
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Legal entity name" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMPANY">Company</option>
          <option value="FUND">Fund</option>
        </select>
        <textarea className="md:col-span-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" rows={3} placeholder="Investment thesis" value={investmentThesis} onChange={(e) => setInvestmentThesis(e.target.value)} />
        <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="GOVERNMENT_ID">Government ID</option>
          <option value="PROOF_OF_ADDRESS">Proof of address</option>
          <option value="COMPANY_REGISTRATION">Company registration</option>
          <option value="TAX_DOCUMENT">Tax document</option>
        </select>
        <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Uploaded document URL" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} />
        <button onClick={() => submit.mutate()} className="md:col-span-2 rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-black">
          Submit for admin review
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm">
        <p className="text-slate-300">
          Current status: <span className="font-semibold text-white">{data?.profile?.verificationStatus ?? "NOT_SUBMITTED"}</span>
        </p>
      </div>
    </main>
  );
}
