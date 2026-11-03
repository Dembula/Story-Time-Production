import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  ContSheetCrew,
  ContSheetDayClock,
  ContSheetDayPayload,
  ContSheetSceneInput,
  ContSheetTotals,
} from "@/lib/cont-sheet/types";

function formatReportDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseHeading(heading: string | null | undefined): { intExt?: string; dayNight?: string; location?: string } {
  const h = (heading ?? "").trim();
  if (!h) return {};
  const intExtMatch = h.match(/\b(INT\.?\/EXT\.?|I\/E|INT\.?|EXT\.?)\b/i);
  const todMatch = h.match(/\b(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|SAME)\b/i);
  let location: string | undefined;
  const dash = h.split(/\s[-–—]\s/);
  if (dash.length >= 2) {
    location = dash[0]
      .replace(/\b(INT\.?\/EXT\.?|I\/E|INT\.?|EXT\.?)\b/gi, "")
      .replace(/\./g, "")
      .trim();
  }
  return {
    intExt: intExtMatch?.[1]?.replace(/\./g, "").toUpperCase(),
    dayNight: todMatch?.[1]?.toUpperCase(),
    location: location || undefined,
  };
}

function estimateFromPages(pageCount: number | null | undefined): string | null {
  if (pageCount == null || !Number.isFinite(pageCount) || pageCount <= 0) return null;
  // Rough script timing: ~1 page ≈ 1 minute
  const sec = Math.round(pageCount * 60);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Build a Cont Sheet day draft from shoot day, call sheet, and scheduled scenes. */
export async function buildContSheetPrefill(
  projectId: string,
  shootDayId: string,
): Promise<ContSheetDayPayload> {
  const [project, shootDay, callSheet] = await Promise.all([
    prisma.originalProject.findUnique({
      where: { id: projectId },
      select: { title: true },
    }),
    prisma.shootDay.findFirst({
      where: { id: shootDayId, projectId },
      include: {
        scenes: {
          orderBy: { order: "asc" },
          include: {
            scene: {
              select: {
                id: true,
                number: true,
                heading: true,
                intExt: true,
                timeOfDay: true,
                pageCount: true,
                primaryLocation: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.callSheet.findFirst({
      where: { projectId, shootDayId },
      orderBy: { version: "desc" },
    }),
  ]);

  if (!shootDay) {
    throw new Error("Shoot day not found.");
  }

  let crew: ContSheetCrew = {};
  if (callSheet?.crewJson) {
    try {
      const parsed = JSON.parse(callSheet.crewJson) as unknown;
      if (Array.isArray(parsed)) {
        const findRole = (...needles: string[]) => {
          const row = parsed.find((r) => {
            if (!r || typeof r !== "object") return false;
            const role = String((r as { role?: string; department?: string }).role ?? (r as { department?: string }).department ?? "").toLowerCase();
            return needles.some((n) => role.includes(n));
          }) as { name?: string; personName?: string } | undefined;
          return row?.name || row?.personName || undefined;
        };
        crew = {
          lineProducer: findRole("line producer"),
          producer: findRole("producer") && !findRole("line producer") ? findRole("producer") : findRole("producer"),
          productionManager: findRole("production manager", "pm", "upm"),
          directors: findRole("director"),
          scriptSupervisor: findRole("script supervisor", "continuity"),
        };
      } else if (parsed && typeof parsed === "object") {
        const o = parsed as Record<string, string>;
        crew = {
          lineProducer: o.lineProducer,
          producer: o.producer,
          productionManager: o.productionManager,
          directors: o.directors || o.director,
          scriptSupervisor: o.scriptSupervisor,
        };
      }
    } catch {
      // ignore bad snapshot
    }
  }

  const dayClock: ContSheetDayClock = {
    callTime: shootDay.callTime ?? undefined,
    wrapTime: shootDay.wrapTime ?? undefined,
  };

  const scenes: ContSheetSceneInput[] = shootDay.scenes.map((link, idx) => {
    const sc = link.scene;
    const headingBits = parseHeading(sc.heading);
    const sceneCode = sc.number.includes("-") ? sc.number : sc.number;
    const episode = sc.number.includes("-") ? sc.number.split("-")[0] : null;
    return {
      projectSceneId: sc.id,
      episode,
      sceneCode,
      dayNight: sc.timeOfDay || headingBits.dayNight || null,
      intExt: sc.intExt || headingBits.intExt || null,
      location: sc.primaryLocation?.name || headingBits.location || shootDay.locationSummary || null,
      weather: null,
      estimatedTiming: estimateFromPages(sc.pageCount),
      actualTiming: null,
      completionStatus: "scheduled",
      sortOrder: idx,
      takes: [
        {
          slate: "",
          takeNumber: null,
          pickup: 1,
          printStatus: "",
          durationSec: null,
          description: "",
          notes: "",
          camera: "A",
          sortOrder: 0,
        },
      ],
    };
  });

  const totals: ContSheetTotals = {
    totalEstTime: "",
    totalActTime: "",
    totalPages: "",
    previous: { scenesShot: 0, screenTime: "0:00:00", cards: 0, slates: 0, pages: "0" },
    today: {
      scenesShot: 0,
      screenTime: "0:00",
      cards: 0,
      slates: 0,
      pages: scenes.reduce((sum, s) => {
        // leave blank; user fills
        return sum;
      }, "0"),
    },
    total: { scenesShot: 0, screenTime: "0:00:00", cards: 0, slates: 0, pages: "0" },
  };

  return {
    shootDayId,
    showTitle: project?.title ?? null,
    productionCompany: null,
    callSheetNumber: callSheet?.version != null ? String(callSheet.version) : null,
    reportDate: formatReportDate(shootDay.date),
    cameraUnit: shootDay.unit || "A",
    crew,
    dayClock,
    scenesSummary: {
      scheduled: scenes.map((s) => s.sceneCode),
      completed: [],
      dropped: [],
      added: [],
      partlyShot: [],
    },
    totals,
    notes: shootDay.dayNotes || shootDay.scenesBeingShot || null,
    scenes,
  };
}
