/** Shared types for Dailies Review Studio */

export type DailiesTakeStatus =
  | "pending"
  | "approved"
  | "circle"
  | "rejected"
  | "reshoot"
  | "safety"
  | "alt";

export type DailiesTakeFlag =
  | "circle_take"
  | "best_performance"
  | "editors_favourite"
  | "directors_pick"
  | "producers_pick"
  | "vfx_pick"
  | "safety_take"
  | "alternative_take"
  | "reshoot_required";

export type DailiesDepartmentId =
  | "director"
  | "cinematography"
  | "script_supervisor"
  | "vfx"
  | "editorial"
  | "producer"
  | "sound"
  | "continuity"
  | "executive";

export type DailiesNotePriority = "low" | "normal" | "high" | "critical";
export type DailiesNoteCategory =
  | "performance"
  | "audio"
  | "continuity"
  | "vfx"
  | "technical"
  | "editorial"
  | "lighting"
  | "general";

export type ClipProductionMetadata = {
  sceneNumber?: string | null;
  shotNumber?: string | null;
  takeNumber?: number | null;
  camera?: string | null;
  lens?: string | null;
  frameRate?: string | null;
  resolution?: string | null;
  codec?: string | null;
  aspectRatio?: string | null;
  iso?: string | null;
  shutterAngle?: string | null;
  whiteBalance?: string | null;
  focalLength?: string | null;
  cameraOperator?: string | null;
  dit?: string | null;
  slate?: string | null;
  recordingTime?: string | null;
  shootDate?: string | null;
  location?: string | null;
  audioChannels?: string | null;
  soundMixer?: string | null;
  timecode?: string | null;
  lutApplied?: string | null;
  colourSpace?: string | null;
  productionNotes?: string | null;
};

export type AiFootageInsight = {
  id: string;
  severity: "info" | "warning" | "opportunity";
  category: string;
  title: string;
  body: string;
  confidence?: number;
};

export type DailiesClipRecord = {
  id: string;
  batchId: string | null;
  sceneId: string | null;
  sceneNumber: string | null;
  sceneHeading: string | null;
  shootDayId: string | null;
  shootDayDate: string | null;
  unit: string | null;
  title: string | null;
  videoUrl: string | null;
  proxyUrl: string | null;
  streamStatus: string;
  shotNumber: string | null;
  takeNumber: number | null;
  camera: string | null;
  lens: string | null;
  slate: string | null;
  location: string | null;
  sequence: string | null;
  editorBin: string | null;
  durationMs: number | null;
  fileSizeBytes: number | null;
  metadata: ClipProductionMetadata | null;
  takeStatus: DailiesTakeStatus;
  takeFlags: DailiesTakeFlag[];
  aiAnalysis: AiFootageInsight[] | null;
  noteCount: number;
  openNoteCount: number;
  createdAt: string;
};

export type DailiesNoteRecord = {
  id: string;
  clipId: string | null;
  batchId: string | null;
  body: string;
  timestampMs: number | null;
  frameNumber: number | null;
  department: string | null;
  priority: DailiesNotePriority;
  status: string;
  category: DailiesNoteCategory | null;
  resolved: boolean;
  drawings: unknown;
  createdAt: string;
  reviewerName: string | null;
};

export type DailiesShootDaySummary = {
  shootDayId: string;
  date: string;
  unit: string | null;
  status: string;
  clipCount: number;
  takeCount: number;
  scenesCompleted: number;
  pendingReviews: number;
  approvedTakes: number;
  circleTakes: number;
  rejectedTakes: number;
  reviewCompletionPercent: number;
  openNotes: number;
  criticalIssues: number;
};

export type DailiesProductionInsight = {
  id: string;
  severity: "info" | "warning" | "opportunity";
  title: string;
  body: string;
  departmentIds?: DailiesDepartmentId[];
  sceneNumbers?: string[];
};

export type DailiesIntelligencePayload = {
  projectId: string;
  generatedAt: string;
  activeShootDay: DailiesShootDaySummary | null;
  summary: {
    totalClips: number;
    totalTakes: number;
    completedScenes: number;
    pendingReviews: number;
    approvedTakes: number;
    circleTakes: number;
    rejectedTakes: number;
    footageUploaded: number;
    footageProcessing: number;
    proxyReady: number;
    openNotes: number;
    criticalIssues: number;
    reviewCompletionPercent: number;
    productionHealthScore: number;
    coveragePercent: number;
    aiQualityScore: number;
  };
  clips: DailiesClipRecord[];
  shootDays: DailiesShootDaySummary[];
  insights: DailiesProductionInsight[];
  linkedTools: Array<{
    label: string;
    href: string;
    description: string;
    status: "ready" | "partial" | "empty";
  }>;
  scriptSceneCount: number;
  storyboardCount: number;
};

export type DailiesDailyReport = {
  shootDayDate: string;
  completedScenes: string[];
  approvedTakes: number;
  circleTakes: number;
  reshootsNeeded: number;
  technicalIssues: string[];
  performanceHighlights: string[];
  continuityAlerts: string[];
  productionRisks: string[];
  tomorrowPrep: string[];
};
