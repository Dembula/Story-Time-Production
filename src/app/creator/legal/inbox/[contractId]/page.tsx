"use client";

import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function LegalInboxContractPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contractId = params.contractId as string;
  const projectId = searchParams.get("projectId") ?? "";

  useEffect(() => {
    if (projectId) {
      router.replace(
        `/creator/projects/${projectId}/pre-production/legal-contracts?tab=inbox&contractId=${encodeURIComponent(contractId)}`,
      );
    } else {
      router.replace(`/creator/pre/legal-contracts?tab=inbox&contractId=${encodeURIComponent(contractId)}`);
    }
  }, [contractId, projectId, router]);

  return (
    <div className="p-8 text-center text-slate-400 text-sm">Redirecting to Legal & Contracts…</div>
  );
}
