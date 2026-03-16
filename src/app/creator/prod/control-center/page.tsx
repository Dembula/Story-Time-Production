"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ControlCenterTool } from "@/components/project-tools/prod/ProductionTools";

function ProdControlCenterContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;
  return <ControlCenterTool projectId={projectId} />;
}

export default function ProdControlCenterPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <ProdControlCenterContent />
    </Suspense>
  );
}

