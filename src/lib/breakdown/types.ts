/** Shared types for Script Breakdown Studio */

export type BreakdownCategoryKey =
  | "characters"
  | "props"
  | "locations"
  | "wardrobe"
  | "extras"
  | "vehicles"
  | "stunts"
  | "sfx"
  | "makeups";

export type BreakdownDepartmentId =
  | "cast"
  | "extras_bg"
  | "locations"
  | "props"
  | "wardrobe"
  | "hair_makeup"
  | "vehicles"
  | "stunts"
  | "sfx_vfx"
  | "camera_grip"
  | "sound"
  | "transport"
  | "safety_legal"
  | "post";

export type SceneBreakdownAnalysis = {
  purpose?: string | null;
  storyImportance?: "low" | "medium" | "high" | "pivotal" | null;
  emotionalTone?: string | null;
  actionLevel?: "minimal" | "moderate" | "heavy" | null;
  dialogueIntensity?: "none" | "light" | "moderate" | "heavy" | null;
  productionRisks?: string[];
  aiFlags?: string[];
  departmentPrep?: string[];
  continuityRisks?: string[];
  budgetDrivers?: string[];
  recommendedPrep?: string[];
};

export type SceneIntelligence = {
  sceneId: string;
  sceneNumber: string;
  heading: string | null;
  intExt: string | null;
  timeOfDay: string | null;
  storyDay: number | null;
  summary: string | null;
  pageCount: number | null;
  status: string;
  estimatedRuntimeMinutes: number;
  estimatedShootHours: number;
  estimatedCrewSize: number;
  complexityScore: number;
  difficultyRating: "low" | "medium" | "high" | "extreme";
  productionRisk: "low" | "medium" | "high";
  safetyRisk: "low" | "medium" | "high";
  weatherDependency: boolean;
  completionPercent: number;
  counts: Record<BreakdownCategoryKey, number>;
  analysis: SceneBreakdownAnalysis | null;
  visualAssetCount: number;
  storyboardHref: string | null;
};

export type CatalogAsset = {
  id: string;
  category: BreakdownCategoryKey;
  departmentId: BreakdownDepartmentId;
  label: string;
  description: string | null;
  sceneIds: string[];
  sceneNumbers: string[];
  meta?: Record<string, unknown>;
};

export type ProductionInsight = {
  id: string;
  severity: "info" | "warning" | "opportunity";
  title: string;
  body: string;
  departmentIds?: BreakdownDepartmentId[];
  sceneNumbers?: string[];
};

export type ReadinessMetric = {
  id: string;
  label: string;
  percent: number;
  detail?: string;
};

export type BreakdownIntelligencePayload = {
  projectId: string;
  generatedAt: string;
  summary: {
    sceneCount: number;
    assetCount: number;
    departmentsTouched: number;
    overallReadiness: number;
    averageComplexity: number;
    highRiskSceneCount: number;
  };
  scenes: SceneIntelligence[];
  catalog: CatalogAsset[];
  insights: ProductionInsight[];
  readiness: ReadinessMetric[];
  departmentCounts: Record<BreakdownDepartmentId, number>;
  linkedTools: Array<{ label: string; href: string; description: string; status: "ready" | "partial" | "empty" }>;
};

export type BreakdownPayload = {
  characters?: {
    id?: string;
    name: string;
    description?: string | null;
    importance?: string | null;
    sceneId?: string | null;
  }[];
  props?: {
    id?: string;
    name: string;
    description?: string | null;
    special?: boolean;
    sceneId?: string | null;
  }[];
  locations?: {
    id?: string;
    name: string;
    description?: string | null;
    sceneId?: string | null;
    locationListingId?: string | null;
  }[];
  wardrobe?: { id?: string; description: string; character?: string | null; sceneId?: string | null }[];
  extras?: { id?: string; description: string; quantity?: number; sceneId?: string | null }[];
  vehicles?: { id?: string; description: string; stuntRelated?: boolean; sceneId?: string | null }[];
  stunts?: { id?: string; description: string; safetyNotes?: string | null; sceneId?: string | null }[];
  sfx?: { id?: string; description: string; practical?: boolean; sceneId?: string | null }[];
  makeups?: { id?: string; notes: string; character?: string | null; sceneId?: string | null }[];
};
