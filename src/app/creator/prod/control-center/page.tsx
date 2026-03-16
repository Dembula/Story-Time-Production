"use client";

import { useSearchParams } from "next/navigation";
import { ControlCenterTool } from "@/components/project-tools/prod/ProductionTools";

export default function ProdControlCenterPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;

  return <ControlCenterTool projectId={projectId} />;
}

