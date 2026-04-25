export type RiskCategory =
  | "SAFETY"
  | "STUNTS"
  | "VEHICLES"
  | "EQUIPMENT"
  | "LOCATIONS"
  | "LEGAL"
  | "WEATHER"
  | "CROWD_CONTROL";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskItemMeta = {
  title?: string | null;
  severity?: RiskLevel;
  likelihood?: RiskLevel;
  mitigationPlan?: string | null;
  assignedRole?: string | null;
  dueDate?: string | null;
  linkedPolicyIds?: string[];
  linkedSceneIds?: string[];
  linkedShootDayIds?: string[];
  linkedResourceIds?: string[];
  linkedResourceType?: "LOCATION" | "EQUIPMENT" | "CONTRACT" | "SCENE" | "OTHER";
  autoDetected?: boolean;
  autoKey?: string;
};

export type InsurancePolicyMeta = {
  id: string;
  providerName: string;
  coverageType: string;
  coverageAmount: number;
  validFrom: string | null;
  validTo: string | null;
  linkedRiskIds: string[];
  notes?: string | null;
};

export type RiskChecklistTemplate = {
  id: string;
  name: string;
  category: RiskCategory;
  checked: boolean;
  note?: string | null;
};

export type RiskPlanMeta = {
  legalDisclaimer?: string | null;
  readyToShootOverride?: boolean;
  safetyOfficerUserId?: string | null;
  producerUserId?: string | null;
  departmentHeads?: Array<{ department: string; userId: string }>;
  policies: InsurancePolicyMeta[];
  checklists: RiskChecklistTemplate[];
};

const ITEM_META_START = "[ST_RISK_ITEM_META]";
const ITEM_META_END = "[/ST_RISK_ITEM_META]";
const PLAN_META_START = "[ST_RISK_PLAN_META]";
const PLAN_META_END = "[/ST_RISK_PLAN_META]";

export function parseRiskItemDescription(text: string | null | undefined): {
  plain: string | null;
  meta: RiskItemMeta;
} {
  const t = (text ?? "").trim();
  if (!t) return { plain: null, meta: {} };
  const start = t.indexOf(ITEM_META_START);
  const end = t.indexOf(ITEM_META_END);
  if (start === -1 || end === -1 || end <= start) {
    return { plain: t, meta: {} };
  }
  const payload = t.slice(start + ITEM_META_START.length, end).trim();
  const before = t.slice(0, start).trim();
  const after = t.slice(end + ITEM_META_END.length).trim();
  const plain = [before, after].filter(Boolean).join("\n\n").trim() || null;
  try {
    const parsed = JSON.parse(payload) as RiskItemMeta;
    return { plain, meta: parsed ?? {} };
  } catch {
    return { plain, meta: {} };
  }
}

export function composeRiskItemDescription(
  plain: string | null | undefined,
  meta: RiskItemMeta,
): string {
  const p = (plain ?? "").trim();
  const hasMeta = Object.keys(meta).length > 0;
  if (!hasMeta) return p;
  const blocks = [p, `${ITEM_META_START}\n${JSON.stringify(meta)}\n${ITEM_META_END}`].filter(Boolean);
  return blocks.join("\n\n");
}

const DEFAULT_PLAN_META: RiskPlanMeta = {
  legalDisclaimer:
    "Risk and insurance outputs are operational guidance only and should be reviewed with qualified legal and insurance professionals.",
  readyToShootOverride: false,
  safetyOfficerUserId: null,
  producerUserId: null,
  departmentHeads: [],
  policies: [],
  checklists: [],
};

export function parseRiskPlanSummary(summary: string | null | undefined): {
  plain: string | null;
  meta: RiskPlanMeta;
} {
  const t = (summary ?? "").trim();
  if (!t) return { plain: null, meta: { ...DEFAULT_PLAN_META } };
  const start = t.indexOf(PLAN_META_START);
  const end = t.indexOf(PLAN_META_END);
  if (start === -1 || end === -1 || end <= start) {
    return { plain: t, meta: { ...DEFAULT_PLAN_META } };
  }
  const payload = t.slice(start + PLAN_META_START.length, end).trim();
  const before = t.slice(0, start).trim();
  const after = t.slice(end + PLAN_META_END.length).trim();
  const plain = [before, after].filter(Boolean).join("\n\n").trim() || null;
  try {
    const parsed = JSON.parse(payload) as Partial<RiskPlanMeta>;
    return {
      plain,
      meta: {
        ...DEFAULT_PLAN_META,
        ...parsed,
        policies: Array.isArray(parsed.policies) ? parsed.policies : [],
        checklists: Array.isArray(parsed.checklists) ? parsed.checklists : [],
        departmentHeads: Array.isArray(parsed.departmentHeads) ? parsed.departmentHeads : [],
      },
    };
  } catch {
    return { plain, meta: { ...DEFAULT_PLAN_META } };
  }
}

export function composeRiskPlanSummary(plain: string | null | undefined, meta: RiskPlanMeta): string {
  const p = (plain ?? "").trim();
  const normalized: RiskPlanMeta = {
    ...DEFAULT_PLAN_META,
    ...meta,
    policies: Array.isArray(meta.policies) ? meta.policies : [],
    checklists: Array.isArray(meta.checklists) ? meta.checklists : [],
    departmentHeads: Array.isArray(meta.departmentHeads) ? meta.departmentHeads : [],
  };
  const blocks = [p, `${PLAN_META_START}\n${JSON.stringify(normalized)}\n${PLAN_META_END}`].filter(Boolean);
  return blocks.join("\n\n");
}

export function defaultRiskChecklistTemplates(): RiskChecklistTemplate[] {
  return [
    { id: "safety-general", name: "General set safety briefing completed", category: "SAFETY", checked: false },
    { id: "stunts-coordinator", name: "Stunt coordinator assigned and briefed", category: "STUNTS", checked: false },
    { id: "vehicle-permit", name: "Vehicle permits and route approvals complete", category: "VEHICLES", checked: false },
    { id: "equipment-handling", name: "Equipment handling protocol confirmed", category: "EQUIPMENT", checked: false },
    { id: "location-compliance", name: "Location permits and hazards reviewed", category: "LOCATIONS", checked: false },
    { id: "legal-waivers", name: "Legal waivers / key contracts signed", category: "LEGAL", checked: false },
    { id: "weather-plan", name: "Weather contingency plan documented", category: "WEATHER", checked: false },
    { id: "crowd-control", name: "Crowd control plan approved", category: "CROWD_CONTROL", checked: false },
  ];
}
