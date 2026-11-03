import type { ContSheetDay, ContSheetScene, ContSheetTake } from "../../../generated/prisma";
import type { ContSheetCrew, ContSheetDayClock, ContSheetTotals } from "@/lib/cont-sheet/types";
import type { ContSheetExportDay } from "@/lib/cont-sheet/html";

type DayWithScenes = ContSheetDay & {
  scenes: (ContSheetScene & { takes: ContSheetTake[] })[];
  shootDay?: { id: string; date: Date; unit: string | null } | null;
};

function asObj<T>(value: unknown): T | null {
  if (value && typeof value === "object") return value as T;
  return null;
}

export function serializeContSheetDay(day: DayWithScenes) {
  return {
    id: day.id,
    projectId: day.projectId,
    shootDayId: day.shootDayId,
    version: day.version,
    showTitle: day.showTitle,
    productionCompany: day.productionCompany,
    callSheetNumber: day.callSheetNumber,
    reportDate: day.reportDate,
    cameraUnit: day.cameraUnit,
    crew: asObj<ContSheetCrew>(day.crewJson) ?? {},
    dayClock: asObj<ContSheetDayClock>(day.dayClockJson) ?? {},
    scenesSummary: day.scenesSummaryJson ?? null,
    totals: asObj<ContSheetTotals>(day.totalsJson) ?? {},
    notes: day.notes,
    createdAt: day.createdAt,
    updatedAt: day.updatedAt,
    shootDay: day.shootDay ?? null,
    scenes: day.scenes
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        id: s.id,
        projectSceneId: s.projectSceneId,
        episode: s.episode,
        sceneCode: s.sceneCode,
        dayNight: s.dayNight,
        intExt: s.intExt,
        location: s.location,
        weather: s.weather,
        turnoverTime: s.turnoverTime,
        estimatedTiming: s.estimatedTiming,
        actualTiming: s.actualTiming,
        completionStatus: s.completionStatus,
        sortOrder: s.sortOrder,
        takes: s.takes
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((t) => ({
            id: t.id,
            slate: t.slate,
            takeNumber: t.takeNumber,
            pickup: t.pickup,
            printStatus: t.printStatus,
            durationSec: t.durationSec,
            description: t.description,
            notes: t.notes,
            camera: t.camera,
            sortOrder: t.sortOrder,
          })),
      })),
  };
}

export function toExportDay(day: ReturnType<typeof serializeContSheetDay>): ContSheetExportDay {
  return {
    showTitle: day.showTitle,
    productionCompany: day.productionCompany,
    callSheetNumber: day.callSheetNumber,
    reportDate: day.reportDate,
    cameraUnit: day.cameraUnit,
    crew: day.crew,
    dayClock: day.dayClock,
    scenesSummary: day.scenesSummary as ContSheetExportDay["scenesSummary"],
    totals: day.totals,
    notes: day.notes,
    scenes: day.scenes.map((s) => ({
      episode: s.episode,
      sceneCode: s.sceneCode,
      dayNight: s.dayNight,
      intExt: s.intExt,
      location: s.location,
      weather: s.weather,
      turnoverTime: s.turnoverTime,
      estimatedTiming: s.estimatedTiming,
      actualTiming: s.actualTiming,
      completionStatus: s.completionStatus,
      takes: s.takes,
    })),
  };
}

/** PRINT takes for dailies soft-matching. */
export function extractPrintTakesForDailies(day: ReturnType<typeof serializeContSheetDay>) {
  const out: {
    sceneCode: string;
    projectSceneId: string | null;
    slate: string | null;
    takeNumber: number | null;
    pickup: number | null;
    durationSec: number | null;
    description: string | null;
    camera: string | null;
  }[] = [];
  for (const scene of day.scenes) {
    for (const take of scene.takes) {
      const status = (take.printStatus ?? "").toUpperCase();
      if (status !== "PRINT") continue;
      out.push({
        sceneCode: scene.sceneCode,
        projectSceneId: scene.projectSceneId,
        slate: take.slate,
        takeNumber: take.takeNumber,
        pickup: take.pickup,
        durationSec: take.durationSec,
        description: take.description,
        camera: take.camera,
      });
    }
  }
  return out;
}
