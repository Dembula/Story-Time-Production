"use client";

import { useSearchParams } from "next/navigation";
import { OnSetTasksTool } from "@/components/project-tools/prod/ProductionTools";

export default function ProdOnSetTasksPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;

  return <OnSetTasksTool projectId={projectId} />;
}

