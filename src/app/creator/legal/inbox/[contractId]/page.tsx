"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractDocumentViewer } from "@/components/legal/contract-document-viewer";
import {
  ContractInAppResponsePanel,
  type ContractInAppResponseAction,
} from "@/components/legal/contract-in-app-response-panel";

export default function LegalInboxContractPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const contractId = params.contractId as string;
  const projectId = searchParams.get("projectId") ?? "";
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [signerName, setSignerName] = useState("");
  const [selectedAction, setSelectedAction] = useState<ContractInAppResponseAction | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [actionError, setActionError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["legal-inbox-contract", contractId],
    queryFn: () => fetch(`/api/creator/legal/inbox/${contractId}`).then((r) => {
      if (!r.ok) throw new Error("Contract not found");
      return r.json();
    }),
  });

  const respondMutation = useMutation({
    mutationFn: async (action: ContractInAppResponseAction) => {
      if (!projectId) throw new Error("Missing project context");
      const res = await fetch(
        `/api/creator/projects/${projectId}/contracts/${contractId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment: comment || null,
            signerName: signerName || null,
            signerRole: "Counterparty",
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-inbox-contract", contractId] });
      queryClient.invalidateQueries({ queryKey: ["legal-inbox"] });
      setActionError("");
      setSubmitted(true);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const contract = data?.contract;

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-96 bg-slate-800/60" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Contract not found or you do not have access.</p>
        <Link href="/creator/legal/inbox" className="text-orange-400 text-sm mt-4 inline-block">
          Back to inbox
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Response recorded</h1>
        <p className="mt-2 text-sm text-slate-400">The production team has been notified.</p>
        <Link href="/creator/legal/inbox" className="text-orange-400 text-sm mt-6 inline-block">
          Back to inbox
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <Link href="/creator/legal/inbox" className="text-slate-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">{contract.subject ?? contract.type}</h1>
          <p className="text-xs text-slate-400">
            {contract.projectTitle}
            {contract.senderName ? ` · Sent by ${contract.senderName}` : ""}
            {" · "}
            {contract.status}
          </p>
        </div>
      </div>

      {actionError && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {actionError}
        </p>
      )}

      <ContractDocumentViewer
        title={contract.subject ?? contract.type}
        terms={contract.latestVersion?.terms ?? ""}
        status={contract.status}
        projectTitle={contract.projectTitle}
        productionCompany={contract.productionCompany}
        jurisdiction={contract.jurisdiction}
        recipientLabel={contract.recipientLabel}
        signatures={contract.signatures}
      />

      {contract.canRespond && (
        <ContractInAppResponsePanel
          signerName={signerName}
          onSignerNameChange={setSignerName}
          comment={comment}
          onCommentChange={setComment}
          selectedAction={selectedAction}
          onSelectAction={setSelectedAction}
          confirmed={confirmed}
          onConfirmedChange={setConfirmed}
          pending={respondMutation.isPending}
          onSubmit={() => selectedAction && respondMutation.mutate(selectedAction)}
        />
      )}

      {contract.events?.length > 0 && (
        <div className="creator-glass-panel p-4">
          <p className="text-sm font-medium text-white mb-2">Audit log</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {contract.events.map((e: { id: string; eventType: string; detail: string | null; actorName: string | null; createdAt: string }) => (
              <li key={e.id}>
                {new Date(e.createdAt).toLocaleString()} — {e.eventType}
                {e.actorName ? ` (${e.actorName})` : ""}
                {e.detail ? `: ${e.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
