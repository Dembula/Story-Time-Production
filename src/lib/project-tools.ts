export type ProjectPhase = "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION";

export type ProjectToolId =
  // Pre
  | "idea-development"
  | "script-writing"
  | "script-review"
  | "script-breakdown"
  | "budget-builder"
  | "production-scheduling"
  | "casting-portal"
  | "crew-marketplace"
  | "location-marketplace"
  | "visual-planning"
  | "legal-contracts"
  | "funding-hub"
  | "table-reads"
  | "production-workspace"
  | "equipment-planning"
  | "risk-insurance"
  | "production-readiness"
  // Production
  | "control-center"
  | "call-sheet-generator"
  | "on-set-tasks"
  | "equipment-tracking"
  | "shoot-progress"
  | "continuity-manager"
  | "dailies-review"
  | "expense-tracker"
  | "incident-reporting"
  | "on-set-catering"
  | "wrap"
  // Post
  | "footage-ingestion"
  | "editing-studio"
  | "sound-design"
  | "music-scoring"
  | "visual-effects"
  | "color-grading"
  | "final-sound-mix"
  | "final-cut-approval"
  | "film-packaging"
  | "distribution";

export interface ProjectToolMeta {
  id: ProjectToolId;
  phase: ProjectPhase;
  label: string;
  description: string;
  /** Route segment used under a project workspace, e.g. /creator/projects/:id/pre-production/[toolSlug] */
  toolSlug: string;
  /** High-level step for progress rollups (SCRIPT, BREAKDOWN, SCHEDULING, SHOOT, EDIT, MIX, DELIVERY, etc.) */
  pipelineStep:
    | "IDEA"
    | "SCRIPT"
    | "BREAKDOWN"
    | "BUDGET"
    | "SCHEDULING"
    | "CASTING"
    | "CREW"
    | "LOCATIONS"
    | "LEGAL"
    | "FUNDING"
    | "PRODUCTION_CONTROL"
    | "ON_SET"
    | "SHOOT"
    | "EQUIPMENT"
    | "RISK"
    | "WRAP"
    | "EDIT"
    | "SOUND"
    | "MUSIC"
    | "VFX"
    | "COLOR"
    | "FINAL_DELIVERY"
    | "PACKAGING"
    | "DISTRIBUTION"
    | "COLLAB";
}

export const PRE_PRODUCTION_TOOLS: ProjectToolMeta[] = [
  {
    id: "idea-development",
    phase: "PRE_PRODUCTION",
    label: "Idea Development",
    description: "Shape your concept, theme, and core promise.",
    toolSlug: "idea-development",
    pipelineStep: "IDEA",
  },
  {
    id: "script-writing",
    phase: "PRE_PRODUCTION",
    label: "Script Writing",
    description: "Draft and refine your script scene by scene.",
    toolSlug: "script-writing",
    pipelineStep: "SCRIPT",
  },
  {
    id: "script-review",
    phase: "PRE_PRODUCTION",
    label: "Script Review",
    description: "Capture internal notes and request executive script reviews.",
    toolSlug: "script-review",
    pipelineStep: "SCRIPT",
  },
  {
    id: "script-breakdown",
    phase: "PRE_PRODUCTION",
    label: "Script Breakdown Studio",
    description: "AI-powered production breakdown hub — scenes, catalog, scheduling, and budget prep.",
    toolSlug: "script-breakdown",
    pipelineStep: "BREAKDOWN",
  },
  {
    id: "budget-builder",
    phase: "PRE_PRODUCTION",
    label: "Budget Builder",
    description: "Template-driven budget by department and line items.",
    toolSlug: "budget-builder",
    pipelineStep: "BUDGET",
  },
  {
    id: "production-scheduling",
    phase: "PRE_PRODUCTION",
    label: "Production Scheduling",
    description: "Plan shoot days, call times, locations, and assign scenes.",
    toolSlug: "production-scheduling",
    pipelineStep: "SCHEDULING",
  },
  {
    id: "casting-portal",
    phase: "PRE_PRODUCTION",
    label: "Casting Portal",
    description: "Manage roles and connect to the casting ecosystem.",
    toolSlug: "casting-portal",
    pipelineStep: "CASTING",
  },
  {
    id: "crew-marketplace",
    phase: "PRE_PRODUCTION",
    label: "Crew Marketplace",
    description: "Define and source crew roles for your project.",
    toolSlug: "crew-marketplace",
    pipelineStep: "CREW",
  },
  {
    id: "location-marketplace",
    phase: "PRE_PRODUCTION",
    label: "Location Marketplace",
    description: "Map breakdown locations to real-world listings.",
    toolSlug: "location-marketplace",
    pipelineStep: "LOCATIONS",
  },
  {
    id: "visual-planning",
    phase: "PRE_PRODUCTION",
    label: "Visual Planning",
    description: "Moodboards and visual references tied to ideas.",
    toolSlug: "visual-planning",
    pipelineStep: "IDEA",
  },
  {
    id: "legal-contracts",
    phase: "PRE_PRODUCTION",
    label: "Legal & Contracts",
    description: "Create and track project contracts and signatures.",
    toolSlug: "legal-contracts",
    pipelineStep: "LEGAL",
  },
  {
    id: "funding-hub",
    phase: "PRE_PRODUCTION",
    label: "Funding Hub",
    description: "Capture funding status, requests, and amounts.",
    toolSlug: "funding-hub",
    pipelineStep: "FUNDING",
  },
  {
    id: "table-reads",
    phase: "PRE_PRODUCTION",
    label: "Table Reads",
    description: "Schedule table reads and capture feedback notes.",
    toolSlug: "table-reads",
    pipelineStep: "SCRIPT",
  },
  {
    id: "production-workspace",
    phase: "PRE_PRODUCTION",
    label: "Production Workspace",
    description: "Central coordination hub for tasks and activity.",
    toolSlug: "production-workspace",
    pipelineStep: "COLLAB",
  },
  {
    id: "equipment-planning",
    phase: "PRE_PRODUCTION",
    label: "Equipment Planning",
    description: "Plan cameras, lighting, audio and link to providers.",
    toolSlug: "equipment-planning",
    pipelineStep: "EQUIPMENT",
  },
  {
    id: "risk-insurance",
    phase: "PRE_PRODUCTION",
    label: "Risk & Insurance",
    description: "Risk checklist across safety, stunts, vehicles, legal.",
    toolSlug: "risk-insurance",
    pipelineStep: "RISK",
  },
  {
    id: "production-readiness",
    phase: "PRE_PRODUCTION",
    label: "Production Readiness Dashboard",
    description: "Final checklist before moving to production.",
    toolSlug: "production-readiness",
    pipelineStep: "PRODUCTION_CONTROL",
  },
];

export const PRODUCTION_TOOLS: ProjectToolMeta[] = [
  {
    id: "control-center",
    phase: "PRODUCTION",
    label: "Production Control Center",
    description: "Today’s shoot snapshot, tasks, and incidents.",
    toolSlug: "control-center",
    pipelineStep: "PRODUCTION_CONTROL",
  },
  {
    id: "call-sheet-generator",
    phase: "PRODUCTION",
    label: "Call Sheet Generator",
    description: "Generate call sheets from your schedule.",
    toolSlug: "call-sheet-generator",
    pipelineStep: "SCHEDULING",
  },
  {
    id: "on-set-tasks",
    phase: "PRODUCTION",
    label: "On-Set Task Management",
    description: "Kanban board for on-set tasks.",
    toolSlug: "on-set-tasks",
    pipelineStep: "ON_SET",
  },
  {
    id: "equipment-tracking",
    phase: "PRODUCTION",
    label: "Equipment Tracking",
    description: "Track equipment planned and in use.",
    toolSlug: "equipment-tracking",
    pipelineStep: "EQUIPMENT",
  },
  {
    id: "shoot-progress",
    phase: "PRODUCTION",
    label: "Shoot Progress Tracker",
    description: "Progress across shoot days and scenes.",
    toolSlug: "shoot-progress",
    pipelineStep: "SHOOT",
  },
  {
    id: "continuity-manager",
    phase: "PRODUCTION",
    label: "Continuity Manager",
    description: "Continuity notes by scene and day.",
    toolSlug: "continuity-manager",
    pipelineStep: "ON_SET",
  },
  {
    id: "dailies-review",
    phase: "PRODUCTION",
    label: "Dailies Review",
    description: "Studio-grade dailies review with AI analysis, circle takes, and editorial handoff.",
    toolSlug: "dailies-review",
    pipelineStep: "ON_SET",
  },
  {
    id: "expense-tracker",
    phase: "PRODUCTION",
    label: "Production Expense Tracker",
    description: "Track actual expenses against budget.",
    toolSlug: "expense-tracker",
    pipelineStep: "BUDGET",
  },
  {
    id: "incident-reporting",
    phase: "PRODUCTION",
    label: "Incident Reporting",
    description: "Log and resolve on-set incidents.",
    toolSlug: "incident-reporting",
    pipelineStep: "RISK",
  },
  {
    id: "on-set-catering",
    phase: "PRODUCTION",
    label: "On-Set Catering",
    description: "Book on-set caterers with menus, galleries, and specializations for shoot days.",
    toolSlug: "on-set-catering",
    pipelineStep: "ON_SET",
  },
  {
    id: "wrap",
    phase: "PRODUCTION",
    label: "Production Wrap",
    description: "Close out production and hand off to post.",
    toolSlug: "wrap",
    pipelineStep: "WRAP",
  },
];

export const POST_PRODUCTION_TOOLS: ProjectToolMeta[] = [
  {
    id: "footage-ingestion",
    phase: "POST_PRODUCTION",
    label: "Footage Ingestion",
    description: "Add and track footage, edits, trailers, and masters.",
    toolSlug: "footage-ingestion",
    pipelineStep: "EDIT",
  },
  {
    id: "editing-studio",
    phase: "POST_PRODUCTION",
    label: "Editing Studio",
    description: "Rough cuts and review sessions for the edit.",
    toolSlug: "editing-studio",
    pipelineStep: "EDIT",
  },
  {
    id: "sound-design",
    phase: "POST_PRODUCTION",
    label: "Sound Design",
    description: "Notes and tracking for FX, ADR, and ambience.",
    toolSlug: "sound-design",
    pipelineStep: "SOUND",
  },
  {
    id: "music-scoring",
    phase: "POST_PRODUCTION",
    label: "Music & Scoring",
    description: "Music selections tied to Story Time’s music library.",
    toolSlug: "music-scoring",
    pipelineStep: "MUSIC",
  },
  {
    id: "visual-effects",
    phase: "POST_PRODUCTION",
    label: "Visual Effects",
    description: "VFX shot tracking via tasks and assets.",
    toolSlug: "visual-effects",
    pipelineStep: "VFX",
  },
  {
    id: "color-grading",
    phase: "POST_PRODUCTION",
    label: "Color Grading",
    description: "Grading status and links to graded masters.",
    toolSlug: "color-grading",
    pipelineStep: "COLOR",
  },
  {
    id: "final-sound-mix",
    phase: "POST_PRODUCTION",
    label: "Final Sound Mix",
    description: "Final mix checklist and master link.",
    toolSlug: "final-sound-mix",
    pipelineStep: "SOUND",
  },
  {
    id: "final-cut-approval",
    phase: "POST_PRODUCTION",
    label: "Final Cut Approval",
    description: "Approve the master cut and tie to delivery.",
    toolSlug: "final-cut-approval",
    pipelineStep: "FINAL_DELIVERY",
  },
  {
    id: "film-packaging",
    phase: "POST_PRODUCTION",
    label: "Film Packaging",
    description: "Checklist for masters, artwork, subtitles, and docs.",
    toolSlug: "film-packaging",
    pipelineStep: "PACKAGING",
  },
  {
    id: "distribution",
    phase: "POST_PRODUCTION",
    label: "Distribution",
    description: "Final delivery status and distribution submissions.",
    toolSlug: "distribution",
    pipelineStep: "DISTRIBUTION",
  },
];

/** Post-production tools surfaced on the creator hub and dashboard (product scope: music + distribution only). */
export const POST_PRODUCTION_HUB_TOOLS: ProjectToolMeta[] = POST_PRODUCTION_TOOLS.filter(
  (t) => t.toolSlug === "music-scoring" || t.toolSlug === "distribution",
);

export const ALL_PROJECT_TOOLS: ProjectToolMeta[] = [
  ...PRE_PRODUCTION_TOOLS,
  ...PRODUCTION_TOOLS,
  ...POST_PRODUCTION_TOOLS,
];

export function findToolBySlug(slug: string): ProjectToolMeta | undefined {
  return ALL_PROJECT_TOOLS.find((t) => t.toolSlug === slug);
}

/** Canonical URL for a tool inside the project workspace (not standalone /creator/pre?projectId=). */
export function getProjectToolHref(
  projectId: string,
  tool: Pick<ProjectToolMeta, "phase" | "toolSlug">,
): string {
  if (tool.phase === "PRE_PRODUCTION") {
    return `/creator/projects/${projectId}/pre-production/${tool.toolSlug}`;
  }
  if (tool.phase === "PRODUCTION") {
    return `/creator/projects/${projectId}/production/${tool.toolSlug}`;
  }
  return `/creator/projects/${projectId}/post-production/${tool.toolSlug}`;
}

const CREATOR_PIPELINE_PHASE_HUBS = new Set([
  "/creator/pre-production",
  "/creator/production",
  "/creator/post-production",
]);

/** Standalone creator routes that map to a pipeline tool (excludes /creator/upload — shared with catalogue). */
const CREATOR_PIPELINE_TOOL_ALIASES = new Set([
  "/creator/cast",
  "/creator/crew",
  "/creator/locations",
  "/creator/equipment",
  "/creator/catering",
  "/creator/music",
]);

/** True when the creator is inside a pre/production/post pipeline tool (not a phase hub). */
export function isCreatorPipelineToolPath(pathname: string): boolean {
  if (CREATOR_PIPELINE_PHASE_HUBS.has(pathname)) return false;
  if (CREATOR_PIPELINE_TOOL_ALIASES.has(pathname)) return true;

  const postStandalone = pathname.match(/^\/creator\/post\/([^/?]+)/);
  if (postStandalone && findToolBySlug(postStandalone[1])) return true;

  const preStandalone = pathname.match(/^\/creator\/pre\/([^/?]+)/);
  if (preStandalone && findToolBySlug(preStandalone[1])) return true;

  const prodStandalone = pathname.match(/^\/creator\/production\/([^/?]+)/);
  if (prodStandalone && findToolBySlug(prodStandalone[1])) return true;

  const prodShortStandalone = pathname.match(/^\/creator\/prod\/([^/?]+)/);
  if (prodShortStandalone && findToolBySlug(prodShortStandalone[1])) return true;

  const projectScoped = pathname.match(
    /^\/creator\/projects\/(?!pre-production|production|post-production)([^/]+)\/(pre-production|production|post-production)\/([^/?]+)/,
  );
  if (projectScoped && findToolBySlug(projectScoped[3])) return true;

  const projectsFolder = pathname.match(
    /^\/creator\/projects\/(pre-production|production|post-production)\/([^/?]+)/,
  );
  if (projectsFolder && findToolBySlug(projectsFolder[2])) return true;

  return false;
}

/** When leaving a linked project workspace, open the same tool standalone (no project). */
export function resolveStandaloneFromProjectPath(pathname: string): string {
  const match = pathname.match(
    /^\/creator\/projects\/[^/]+\/(pre-production|production|post-production)\/([^/?]+)/,
  );
  if (!match) return "/creator/dashboard";
  const phaseFolder = match[1];
  const slug = match[2];
  if (phaseFolder === "pre-production") {
    const map: Record<string, string> = {
      "casting-portal": "/creator/cast",
      "crew-marketplace": "/creator/crew",
      "location-marketplace": "/creator/locations",
      "equipment-planning": "/creator/equipment",
    };
    return map[slug] ?? `/creator/pre/${slug}`;
  }
  if (phaseFolder === "production") {
    const map: Record<string, string> = {
      "on-set-catering": "/creator/catering",
    };
    return map[slug] ?? `/creator/production/${slug}`;
  }
  if (slug === "distribution") return "/creator/upload";
  if (slug === "footage-ingestion") return "/creator/post/footage-ingestion";
  if (slug === "music-scoring") return "/creator/music";
  return "/creator/post-production";
}

