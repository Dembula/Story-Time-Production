import type { ExecutiveOffice } from "@/lib/executive/seat-map";

export type DataFreshness = {
  mode: "LIVE" | "DELAYED" | "DAILY";
  generatedAt: string;
  label: string;
};

export type ExecutiveKpi = {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  deltaPct?: number | null;
  tone?: "neutral" | "good" | "warn" | "bad";
  freshness: DataFreshness;
  sourcePending?: boolean;
};

export type ExecutiveAlert = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  offices: ExecutiveOffice[];
  href?: string;
  metric?: string;
  currentValue?: string;
  expectedValue?: string;
};

export type ExecutiveRelationshipChain = {
  id: string;
  label: string;
  steps: string[];
};

/** Shared entity vocabulary for the executive graph. */
export type ExecutiveEntityKind =
  | "Viewer"
  | "Creator"
  | "Film"
  | "Series"
  | "Episode"
  | "Subscription"
  | "Payment"
  | "Revenue"
  | "Campaign"
  | "MarketingEvent"
  | "PlatformEvent"
  | "AIEvent"
  | "EncodingJob"
  | "PlaybackSession"
  | "TechnicalIncident"
  | "CalendarEvent"
  | "Report"
  | "Message";
