"use client";

import { FootageIngestion, MusicScoring, Distribution } from "@/app/creator/projects/[projectId]/post-production/[tool]/page";

export interface PostProductionToolProps {
  projectId?: string;
}

export function FootageIngestionTool({ projectId }: PostProductionToolProps) {
  return <FootageIngestion projectId={projectId} title="Footage Ingestion" />;
}

export function MusicScoringTool({ projectId }: PostProductionToolProps) {
  return <MusicScoring projectId={projectId} title="Music & Scoring" />;
}

export function DistributionTool({ projectId }: PostProductionToolProps) {
  return <Distribution projectId={projectId} title="Distribution" />;
}

