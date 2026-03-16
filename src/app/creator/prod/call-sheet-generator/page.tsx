"use client";

import { useSearchParams } from "next/navigation";
import { CallSheetGeneratorTool } from "@/components/project-tools/prod/ProductionTools";

export default function ProdCallSheetGeneratorPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;

  return <CallSheetGeneratorTool projectId={projectId} />;
}

