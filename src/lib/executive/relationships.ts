import type { ExecutiveRelationshipChain } from "@/lib/executive/types";

export const EXECUTIVE_RELATIONSHIP_CHAINS: ExecutiveRelationshipChain[] = [
  {
    id: "growth",
    label: "Acquisition → Revenue",
    steps: ["Campaign", "Sign-up", "Subscription", "Viewing", "Retention", "Revenue"],
  },
  {
    id: "creator",
    label: "Creator → Earnings",
    steps: ["Creator", "Film", "Views", "Watch Time", "Subscription Conversion", "Creator Revenue"],
  },
  {
    id: "pipeline",
    label: "Upload → Viewer retention",
    steps: ["Upload", "Encoding", "QC", "Publication", "Playback", "Buffering", "Viewer Retention"],
  },
  {
    id: "ai",
    label: "AI feature load",
    steps: ["AI Feature", "Requests", "Tokens/Usage", "Latency", "Cost", "System Load"],
  },
];
