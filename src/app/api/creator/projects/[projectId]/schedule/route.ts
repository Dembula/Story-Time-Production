import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createShootDay,
  getSchedule,
  saveSchedule,
  updateScenesLibraryFromScript,
  ScheduleScene,
  ShootDayRecord,
} from "@/lib/scheduleStore";
import { listScriptsForUser } from "@/lib/scriptStore";

interface Params {
  params: { projectId: string };
}

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

function parseScenesFromScript(content: string): ScheduleScene[] {
  const lines = content.split(/\r?\n/);
  const scenes: ScheduleScene[] = [];
  let sceneNumber = 1;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(INT\.|EXT\.)/i.test(trimmed)) {
      scenes.push({
        id: `${sceneNumber}`,
        number: `${sceneNumber}`,
        heading: trimmed,
      });
      sceneNumber += 1;
    }
  }
  return scenes;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  let schedule = await getSchedule(params.projectId);

  // Seed scenes library from script if empty
  if (schedule.scenes.length === 0) {
    const scripts = await listScriptsForUser({
      userId: access.userId!,
      projectId: params.projectId,
    });
    const latest = scripts[0];
    if (latest?.content) {
      const parsed = parseScenesFromScript(latest.content);
      schedule = await updateScenesLibraryFromScript(params.projectId, parsed);
    }
  }

  const scenesById = new Map(schedule.scenes.map((s) => [s.id, s]));

  return NextResponse.json({
    shootDays: schedule.shootDays.map((d) => ({
      ...d,
      scenes: d.scenes.map((link) => ({
        id: `${d.id}-${link.sceneId}`,
        order: link.order,
        scene: scenesById.get(link.sceneId) ?? {
          id: link.sceneId,
          number: link.sceneId,
          heading: null,
        },
      })),
    })),
    scenes: schedule.scenes,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        date?: string;
      }
    | null;

  const date = body?.date ?? new Date().toISOString();
  const day = await createShootDay(params.projectId, date);
  return NextResponse.json({ day }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        days: {
          id: string;
          date: string;
          unit: string | null;
          callTime: string | null;
          wrapTime: string | null;
          locationSummary: string | null;
          status: string;
          scenesBeingShot?: string | null;
          scenes: { sceneId: string; order: number }[];
        }[];
      }
    | null;

  if (!body?.days) {
    return NextResponse.json({ error: "Missing days" }, { status: 400 });
  }

  const current = await getSchedule(params.projectId);
  const existingById = new Map(current.shootDays.map((d) => [d.id, d]));

  const nextDays: ShootDayRecord[] = body.days.map((d) => {
    const base = existingById.get(d.id) as ShootDayRecord | undefined;
    return {
      id: d.id,
      date: d.date,
      unit: d.unit ?? null,
      callTime: d.callTime ?? null,
      wrapTime: d.wrapTime ?? null,
      status: d.status ?? base?.status ?? "PLANNED",
      locationSummary: d.locationSummary ?? null,
      scenesBeingShot: d.scenesBeingShot ?? base?.scenesBeingShot ?? null,
      scenes: d.scenes.map((s) => ({
        sceneId: s.sceneId,
        order: s.order,
      })),
    };
  });

  const updated = await saveSchedule(params.projectId, nextDays);
  return NextResponse.json({ schedule: updated });
}
