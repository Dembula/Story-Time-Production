"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OnSetTasksTool } from "@/components/project-tools/prod/ProductionTools";

function ProdOnSetTasksContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;
  return <OnSetTasksTool projectId={projectId} />;
}

export default function ProdOnSetTasksPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <ProdOnSetTasksContent />
    </Suspense>
  );
}

