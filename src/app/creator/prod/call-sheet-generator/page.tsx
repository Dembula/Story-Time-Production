"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CallSheetGeneratorTool } from "@/components/project-tools/prod/ProductionTools";

function ProdCallSheetGeneratorContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;
  return <CallSheetGeneratorTool projectId={projectId} />;
}

export default function ProdCallSheetGeneratorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <ProdCallSheetGeneratorContent />
    </Suspense>
  );
}

