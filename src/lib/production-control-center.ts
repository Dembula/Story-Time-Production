import type { ProductionDayRecord } from "@/lib/production-day-engine";

export type SceneLiveStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export type PersonLiveStatus =
  | "EXPECTED"
  | "CHECKED_IN"
  | "ON_SET"
  | "ON_BREAK"
  | "DELAYED"
  | "WRAPPED";

export type EquipmentLiveStatus =
  | "PLANNED"
  | "RESERVED"
  | "DELIVERED"
  | "IN_USE"
  | "IDLE"
  | "ISSUE_REPORTED"
  | "RETURNED";

export type SceneProgressEntry = {
  status: SceneLiveStatus;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  notes?: string | null;
};

export type LocationLiveState = {
  access?: "OPEN" | "RESTRICTED" | "CLOSED";
  notes?: string | null;
};

export type ControlAlert = {
  id: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  type: string;
  message: string;
};

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function mergeSceneProgress(
  existing: unknown,
  shootDaySceneId: string,
  patch: Partial<SceneProgressEntry>,
): Record<string, SceneProgressEntry> {
  const base = asRecord(existing) as Record<string, SceneProgressEntry>;
  const prev = base[shootDaySceneId] ?? { status: "NOT_STARTED" as const };
  return {
    ...base,
    [shootDaySceneId]: {
      ...prev,
      ...patch,
      status: (patch.status !== undefined ? patch.status : prev.status) as SceneLiveStatus,
    },
  };
}

export function mergeKeyedStatuses<T extends string>(
  existing: unknown,
  key: string,
  status: T,
): Record<string, string> {
  const base = asRecord(existing) as Record<string, string>;
  return { ...base, [key]: status };
}

export function buildDefaultCastStatuses(day: ProductionDayRecord | null): Record<string, PersonLiveStatus> {
  const out: Record<string, PersonLiveStatus> = {};
  if (!day) return out;
  for (const c of day.castRequired) {
    out[c.key] = "EXPECTED";
  }
  return out;
}

export function buildDefaultCrewStatuses(day: ProductionDayRecord | null): Record<string, PersonLiveStatus> {
  const out: Record<string, PersonLiveStatus> = {};
  if (!day) return out;
  for (const c of day.crewRequired) {
    out[c.key] = "EXPECTED";
  }
  return out;
}

export function buildDefaultEquipmentStatuses(day: ProductionDayRecord | null): Record<string, EquipmentLiveStatus> {
  const out: Record<string, EquipmentLiveStatus> = {};
  if (!day) return out;
  for (const e of day.equipmentRequired) {
    out[e.key] = "PLANNED";
  }
  return out;
}

function applyBoardPerson(
  defaults: Record<string, PersonLiveStatus>,
  board: unknown,
): Record<string, PersonLiveStatus> {
  const b = asRecord(board);
  const merged = { ...defaults };
  for (const k of Object.keys(b)) {
    const v = b[k];
    if (typeof v === "string") merged[k] = v as PersonLiveStatus;
  }
  return merged;
}

function applyBoardEquipment(
  defaults: Record<string, EquipmentLiveStatus>,
  board: unknown,
): Record<string, EquipmentLiveStatus> {
  const b = asRecord(board);
  const merged = { ...defaults };
  for (const k of Object.keys(b)) {
    const v = b[k];
    if (typeof v === "string") merged[k] = v as EquipmentLiveStatus;
  }
  return merged;
}

function applyBoardScenes(
  sceneLinks: { id: string }[],
  board: unknown,
): Record<string, SceneProgressEntry> {
  const b = asRecord(board) as Record<string, SceneProgressEntry>;
  const out: Record<string, SceneProgressEntry> = {};
  for (const link of sceneLinks) {
    out[link.id] = b[link.id] ?? { status: "NOT_STARTED" };
  }
  return out;
}

export function computeControlAlerts(input: {
  shootDay: { id: string; callTime: string | null; date: Date };
  sceneProgress: Record<string, SceneProgressEntry>;
  sceneMeta: Array<{ shootDaySceneId: string; estimatedMinutes: number; number: string }>;
  castStatus: Record<string, PersonLiveStatus>;
  crewStatus: Record<string, PersonLiveStatus>;
  equipmentStatus: Record<string, EquipmentLiveStatus>;
  tasks: Array<{ id: string; title: string; status: string; priority: string | null; dueDate: Date | null }>;
  incidents: Array<{ id: string; title: string; severity: string; resolved: boolean; category: string | null }>;
  acknowledged: Set<string>;
}): ControlAlert[] {
  const alerts: ControlAlert[] = [];
  const now = Date.now();

  for (const t of input.tasks) {
    if (t.status === "DONE") continue;
    if (t.dueDate && t.dueDate.getTime() < now) {
      const id = `task-overdue:${t.id}`;
      if (!input.acknowledged.has(id)) {
        alerts.push({
          id,
          severity: t.priority === "HIGH" ? "HIGH" : "MEDIUM",
          type: "TASK_OVERDUE",
          message: `Overdue task: ${t.title}`,
        });
      }
    }
  }

  for (const inc of input.incidents) {
    if (inc.resolved) continue;
    if (inc.severity === "HIGH") {
      const id = `incident-open:${inc.id}`;
      if (!input.acknowledged.has(id)) {
        alerts.push({
          id,
          severity: "HIGH",
          type: "INCIDENT_OPEN",
          message: `Open incident (${inc.category ?? "GENERAL"}): ${inc.title}`,
        });
      }
    }
  }

  for (const [eqKey, st] of Object.entries(input.equipmentStatus)) {
    if (st === "ISSUE_REPORTED") {
      const id = `eq-issue:${eqKey}`;
      if (!input.acknowledged.has(id)) {
        alerts.push({ id, severity: "HIGH", type: "EQUIPMENT_ISSUE", message: `Equipment issue: ${eqKey}` });
      }
    }
  }

  for (const [k, st] of Object.entries(input.castStatus)) {
    if (st === "DELAYED") {
      const id = `cast-delay:${k}`;
      if (!input.acknowledged.has(id)) {
        alerts.push({ id, severity: "MEDIUM", type: "CAST_DELAY", message: `Cast delay flagged: ${k}` });
      }
    }
  }
  for (const [k, st] of Object.entries(input.crewStatus)) {
    if (st === "DELAYED") {
      const id = `crew-delay:${k}`;
      if (!input.acknowledged.has(id)) {
        alerts.push({ id, severity: "MEDIUM", type: "CREW_DELAY", message: `Crew delay flagged: ${k}` });
      }
    }
  }

  for (const sm of input.sceneMeta) {
    const prog = input.sceneProgress[sm.shootDaySceneId];
    if (prog?.status === "IN_PROGRESS" && prog.actualStartAt) {
      const start = new Date(prog.actualStartAt).getTime();
      const elapsedMin = (now - start) / 60000;
      if (elapsedMin > sm.estimatedMinutes * 1.35) {
        const id = `scene-long:${sm.shootDaySceneId}`;
        if (!input.acknowledged.has(id)) {
          alerts.push({
            id,
            severity: "MEDIUM",
            type: "SCENE_OVERRUN",
            message: `Scene ${sm.number} running long vs planned ~${sm.estimatedMinutes}m`,
          });
        }
      }
    }
  }

  const rank = (s: string) => (s === "HIGH" ? 0 : s === "MEDIUM" ? 1 : 2);
  return alerts.sort((a, b) => rank(a.severity) - rank(b.severity));
}

export function mergeLiveView(
  prodDay: ProductionDayRecord | null,
  board: {
    sceneProgress: unknown;
    castStatus: unknown;
    crewStatus: unknown;
    equipmentStatus: unknown;
    locationStatus: unknown;
  },
  sceneLinks: { id: string }[],
): {
  sceneProgress: Record<string, SceneProgressEntry>;
  castStatus: Record<string, PersonLiveStatus>;
  crewStatus: Record<string, PersonLiveStatus>;
  equipmentStatus: Record<string, EquipmentLiveStatus>;
  locationStatus: LocationLiveState;
} {
  return {
    sceneProgress: applyBoardScenes(sceneLinks, board.sceneProgress),
    castStatus: applyBoardPerson(buildDefaultCastStatuses(prodDay), board.castStatus),
    crewStatus: applyBoardPerson(buildDefaultCrewStatuses(prodDay), board.crewStatus),
    equipmentStatus: applyBoardEquipment(buildDefaultEquipmentStatuses(prodDay), board.equipmentStatus),
    locationStatus: (asRecord(board.locationStatus) as LocationLiveState) || {},
  };
}
