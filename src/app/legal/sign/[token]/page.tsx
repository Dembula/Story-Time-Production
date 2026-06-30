"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ContractDocumentViewer } from "@/components/legal/contract-document-viewer";
import {
  ContractInAppResponsePanel,
  type ContractInAppResponseAction,
} from "@/components/legal/contract-in-app-response-panel";

export default function GuestContractSignPage() {
  const params = useParams();
  const token = params.token as string;
  const [signerName, setSignerName] = useState("");
  const [comment, setComment] = useState("");
  const [selectedAction, setSelectedAction] = useState<ContractInAppResponseAction | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [payload, setPayload] = useState<{
    projectTitle: string;
    subject: string | null;
    terms: string;
    watermark: string | null;
    signerLabel: string;
    canSignNow?: boolean;
    waitingForPriorSigner?: boolean;
    error?: string;
  } | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetch(`/api/legal/guest/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) setPayload({ projectTitle: "", subject: null, terms: "", watermark: null, signerLabel: "", error: data.error });
        else setPayload(data);
        setLoading(false);
      })
      .catch(() => {
        setPayload({ projectTitle: "", subject: null, terms: "", watermark: null, signerLabel: "", error: "Could not load" });
        setLoading(false);
      });
  }, [token]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading contract…</div>;
  if (payload?.error) return <div className="p-8 text-center text-red-400">{payload.error}</div>;
  if (done) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Response recorded</h1>
        <p className="mt-2 text-sm text-slate-400">Thank you. The production team has been notified.</p>
      </div>
    );
  }

  const submit = async () => {
    if (!selectedAction) return;
    setSubmitting(true);
    setSubmitError("");
    const r = await fetch(`/api/legal/guest/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: selectedAction,
        signerName,
        comment: comment || null,
      }),
    });
    const data = await r.json();
    setSubmitting(false);
    if (!r.ok) setSubmitError(data.error ?? "Could not submit response");
    else setDone(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-orange-300/80">Story Time · Contract response</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{payload?.projectTitle}</h1>
        <p className="text-sm text-slate-400">{payload?.subject}</p>
        <p className="mt-1 text-xs text-slate-500">Responding as: {payload?.signerLabel}</p>
      </header>
      <ContractDocumentViewer title={payload?.subject ?? "Contract"} terms={payload?.terms ?? ""} status={payload?.watermark ? "SENT" : "DRAFT"} projectTitle={payload?.projectTitle} />
      {payload?.waitingForPriorSigner ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          This contract uses sequential signing. You will receive a new email when it is your turn to respond.
        </div>
      ) : (
        <>
          {submitError && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {submitError}
            </p>
          )}
          <ContractInAppResponsePanel
            signerName={signerName}
            onSignerNameChange={setSignerName}
            comment={comment}
            onCommentChange={setComment}
            selectedAction={selectedAction}
            onSelectAction={setSelectedAction}
            confirmed={confirmed}
            onConfirmedChange={setConfirmed}
            pending={submitting}
            onSubmit={submit}
          />
        </>
      )}
    </div>
  );
}
