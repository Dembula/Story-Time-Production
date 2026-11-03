export type ContSheetCrew = {
  lineProducer?: string;
  producer?: string;
  productionManager?: string;
  directors?: string;
  scriptSupervisor?: string;
};

export type ContSheetDayClock = {
  callTime?: string;
  firstTurnover?: string;
  lunch?: string;
  firstShotAfterLunch?: string;
  wrapTime?: string;
};

export type ContSheetTotalsBucket = {
  scenesShot?: number;
  screenTime?: string;
  cards?: number;
  slates?: number;
  pages?: string;
};

export type ContSheetTotals = {
  totalEstTime?: string;
  totalActTime?: string;
  totalPages?: string;
  previous?: ContSheetTotalsBucket;
  today?: ContSheetTotalsBucket;
  total?: ContSheetTotalsBucket;
};

export type ContSheetCompletionStatus =
  | "scheduled"
  | "completed"
  | "dropped"
  | "added"
  | "partlyShot";

export type ContSheetPrintStatus = "PRINT" | "NG" | "" | null;

export type ContSheetTakeInput = {
  id?: string;
  slate?: string | null;
  takeNumber?: number | null;
  pickup?: number | null;
  printStatus?: string | null;
  durationSec?: number | null;
  description?: string | null;
  notes?: string | null;
  camera?: string | null;
  sortOrder?: number;
};

export type ContSheetSceneInput = {
  id?: string;
  projectSceneId?: string | null;
  episode?: string | null;
  sceneCode: string;
  dayNight?: string | null;
  intExt?: string | null;
  location?: string | null;
  weather?: string | null;
  turnoverTime?: string | null;
  estimatedTiming?: string | null;
  actualTiming?: string | null;
  completionStatus?: ContSheetCompletionStatus | string;
  sortOrder?: number;
  takes?: ContSheetTakeInput[];
};

export type ContSheetDayPayload = {
  id?: string;
  shootDayId: string;
  version?: number;
  showTitle?: string | null;
  productionCompany?: string | null;
  callSheetNumber?: string | null;
  reportDate?: string | null;
  cameraUnit?: string | null;
  crew?: ContSheetCrew | null;
  dayClock?: ContSheetDayClock | null;
  scenesSummary?: unknown;
  totals?: ContSheetTotals | null;
  notes?: string | null;
  scenes?: ContSheetSceneInput[];
};

export function formatDurationMss(totalSec: number | null | undefined): string {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return "";
  const s = Math.round(totalSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function parseDurationToSec(value: string | null | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length === 1) {
    const n = Number(parts[0]);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (parts.length === 2) {
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
    return Math.round(m * 60 + s);
  }
  if (parts.length === 3) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const s = Number(parts[2]);
    if (![h, m, s].every(Number.isFinite)) return null;
    return Math.round(h * 3600 + m * 60 + s);
  }
  return null;
}

export function normalizePrintStatus(value: string | null | undefined): string {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "PRINT" || v === "P" || v === "CIRCLE") return "PRINT";
  if (v === "NG" || v === "N/G" || v === "NOT GOOD") return "NG";
  return value?.trim() ? value.trim() : "";
}
