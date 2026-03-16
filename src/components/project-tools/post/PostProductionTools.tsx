"use client";

import { Distribution, FootageIngestion, MusicScoring } from "./PostProductionWidgets";

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

