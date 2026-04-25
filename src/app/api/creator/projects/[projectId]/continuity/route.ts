import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONTINUITY_META_START = "[ST_CONTINUITY_META]";
const CONTINUITY_META_END = "[/ST_CONTINUITY_META]";

type ContinuityCategory =
  | "WARDROBE"
  | "PROPS"
  | "HAIR_MAKEUP"
  | "BLOCKING"
  | "LIGHTING"
  | "CAMERA"
  | "ENVIRONMENT"
  | "PERFORMANCE"
  | "GENERAL";

type TakeStatus = "GOOD" | "USABLE" | "BEST" | "DISCARD";

type ContinuityMeta = {
  kind?: "SCENE" | "TAKE" | "DAY";
  category?: ContinuityCategory;
  takeNumber?: number | null;
  takeStatus?: TakeStatus | null;
  tags?: string[];
  actorIds?: string[];
  actorNames?: string[];
  plannedTimeOfDay?: string | null;
  actualTimeOfDay?: string | null;
  locationLabel?: string | null;
  cameraSetup?: string | null;
  lens?: string | null;
  movement?: string | null;
  linkedImageUrls?: string[];
  linkedVideoUrls?: string[];
  capturedAt?: string | null;
  capturedByUserId?: string | null;
  capturedByName?: string | null;
  compareAgainstNoteId?: string | null;
};

function parseContinuityBody(body: string | null | undefined): { plain: string; meta: ContinuityMeta } {
  const src = (body ?? "").trim();
  if (!src) return { plain: "", meta: {} };
  const start = src.indexOf(CONTINUITY_META_START);
  const end = src.indexOf(CONTINUITY_META_END);
  if (start === -1 || end === -1 || end <= start) return { plain: src, meta: {} };
  const payload = src.slice(start + CONTINUITY_META_START.length, end).trim();
  const before = src.slice(0, start).trim();
  const after = src.slice(end + CONTINUITY_META_END.length).trim();
  const plain = [before, after].filter(Boolean).join("\n\n").trim();
  try {
    return { plain, meta: (JSON.parse(payload) as ContinuityMeta) ?? {} };
  } catch {
    return { plain, meta: {} };
  }
}

function composeContinuityBody(plain: string, meta: ContinuityMeta): string {
  const p = plain.trim();
  const hasMeta = Object.values(meta).some((v) => v !== undefined && v !== null && `${v}` !== "");
  if (!hasMeta) return p;
  const payload = `${CONTINUITY_META_START}\n${JSON.stringify(meta)}\n${CONTINUITY_META_END}`;
  return p ? `${p}\n\n${payload}` : payload;
}

function parseMediaString(value: string | null | undefined): string[] {
  const src = (value ?? "").trim();
  if (!src) return [];
  try {
    const parsed = JSON.parse(src) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // fallback below
  }
  return src
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toJsonMedia(value: string[] | undefined): string | null {
  const arr = (value ?? []).filter(Boolean);
  return arr.length ? JSON.stringify(arr) : null;
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const sceneId = searchParams.get("sceneId");
  const shootDayId = searchParams.get("shootDayId");
  const category = searchParams.get("category");
  const takeNumber = Number(searchParams.get("takeNumber") ?? "");
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const compareLeftId = searchParams.get("compareLeftId");
  const compareRightId = searchParams.get("compareRightId");

  const [notesRaw, scenes, shootDays] = await Promise.all([
    prisma.continuityNote.findMany({
      where: {
        projectId,
        ...(sceneId ? { sceneId } : {}),
        ...(shootDayId ? { shootDayId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
      include: {
        breakdownCharacters: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, status: true, locationSummary: true, scenesBeingShot: true },
    }),
  ]);

  const sceneMap = new Map(
    scenes.map((s) => [
      s.id,
      {
        id: s.id,
        number: s.number,
        heading: s.heading,
        intExt: s.intExt,
        dayNight: s.timeOfDay,
        storyDay: s.storyDay,
        characters: s.breakdownCharacters.map((c) => ({ id: c.id, name: c.name })),
      },
    ]),
  );
  const shootDayMap = new Map(
    shootDays.map((d) => [
      d.id,
      {
        id: d.id,
        date: d.date.toISOString(),
        status: d.status,
        locationSummary: d.locationSummary,
        scenesBeingShot: d.scenesBeingShot,
      },
    ]),
  );

  const notes = notesRaw
    .map((n) => {
      const parsed = parseContinuityBody(n.body);
      const images = parseMediaString(n.photoUrls).filter((url) => !/\.(mp4|mov|webm|mkv)(\?|$)/i.test(url));
      const videos = parseMediaString(n.photoUrls).filter((url) => /\.(mp4|mov|webm|mkv)(\?|$)/i.test(url));
      const linkedImages = parsed.meta.linkedImageUrls ?? images;
      const linkedVideos = parsed.meta.linkedVideoUrls ?? videos;
      return {
        id: n.id,
        projectId: n.projectId,
        sceneId: n.sceneId,
        scene: n.sceneId ? sceneMap.get(n.sceneId) ?? null : null,
        shootDayId: n.shootDayId,
        shootDay: n.shootDayId ? shootDayMap.get(n.shootDayId) ?? null : null,
        body: parsed.plain,
        createdAt: n.createdAt.toISOString(),
        createdBy: n.createdBy ? { id: n.createdBy.id, name: n.createdBy.name, email: n.createdBy.email } : null,
        meta: {
          kind: parsed.meta.kind ?? "SCENE",
          category: parsed.meta.category ?? "GENERAL",
          takeNumber: parsed.meta.takeNumber ?? null,
          takeStatus: parsed.meta.takeStatus ?? null,
          tags: parsed.meta.tags ?? [],
          actorIds: parsed.meta.actorIds ?? [],
          actorNames: parsed.meta.actorNames ?? [],
          plannedTimeOfDay: parsed.meta.plannedTimeOfDay ?? null,
          actualTimeOfDay: parsed.meta.actualTimeOfDay ?? null,
          locationLabel: parsed.meta.locationLabel ?? null,
          cameraSetup: parsed.meta.cameraSetup ?? null,
          lens: parsed.meta.lens ?? null,
          movement: parsed.meta.movement ?? null,
          linkedImageUrls: linkedImages,
          linkedVideoUrls: linkedVideos,
          capturedAt: parsed.meta.capturedAt ?? n.createdAt.toISOString(),
          capturedByUserId: parsed.meta.capturedByUserId ?? n.createdById ?? null,
          capturedByName: parsed.meta.capturedByName ?? n.createdBy?.name ?? null,
          compareAgainstNoteId: parsed.meta.compareAgainstNoteId ?? null,
        },
      };
    })
    .filter((n) => {
      if (category && n.meta.category !== category) return false;
      if (Number.isFinite(takeNumber) && searchParams.get("takeNumber") && (n.meta.takeNumber ?? -1) !== takeNumber) return false;
      if (!q) return true;
      const haystack = [
        n.body,
        n.scene?.number,
        n.scene?.heading,
        n.meta.category,
        ...(n.meta.actorNames ?? []),
        ...(n.meta.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

  const inconsistentNotes = notes.filter((n) => {
    if (!n.sceneId) return false;
    const others = notes.filter((x) => x.id !== n.id && x.sceneId === n.sceneId && x.meta.category === n.meta.category);
    return others.some((x) => (x.meta.takeNumber ?? null) !== (n.meta.takeNumber ?? null) && x.body && n.body && x.body !== n.body);
  }).map((n) => n.id);
  const missingReferenceSceneIds = scenes
    .filter((s) => !notes.some((n) => n.sceneId === s.id && (n.meta.linkedImageUrls?.length ?? 0) > 0))
    .map((s) => s.id);

  const compare = compareLeftId && compareRightId
    ? {
        left: notes.find((n) => n.id === compareLeftId) ?? null,
        right: notes.find((n) => n.id === compareRightId) ?? null,
      }
    : null;

  return NextResponse.json({
    notes,
    scenes: scenes.map((s) => ({
      id: s.id,
      number: s.number,
      heading: s.heading,
      intExt: s.intExt,
      dayNight: s.timeOfDay,
      storyDay: s.storyDay,
      characters: s.breakdownCharacters.map((c) => ({ id: c.id, name: c.name })),
    })),
    shootDays: shootDays.map((d) => ({
      id: d.id,
      date: d.date.toISOString(),
      status: d.status,
      locationSummary: d.locationSummary,
      scenesBeingShot: d.scenesBeingShot,
    })),
    flags: {
      inconsistentNoteIds: inconsistentNotes,
      missingReferenceSceneIds,
      missingReferenceCount: missingReferenceSceneIds.length,
      inconsistentCount: inconsistentNotes.length,
    },
    compare,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        sceneId?: string;
        shootDayId?: string;
        body: string;
        photoUrls?: string | string[];
        meta?: ContinuityMeta;
      }
    | null;

  if (!body?.body) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  const photoUrls =
    typeof body.photoUrls === "string"
      ? parseMediaString(body.photoUrls)
      : Array.isArray(body.photoUrls)
        ? body.photoUrls.filter(Boolean)
        : [];
  const mergedMeta: ContinuityMeta = {
    ...(body.meta ?? {}),
    linkedImageUrls:
      body.meta?.linkedImageUrls && body.meta.linkedImageUrls.length > 0
        ? body.meta.linkedImageUrls
        : photoUrls.filter((url) => !/\.(mp4|mov|webm|mkv)(\?|$)/i.test(url)),
    linkedVideoUrls:
      body.meta?.linkedVideoUrls && body.meta.linkedVideoUrls.length > 0
        ? body.meta.linkedVideoUrls
        : photoUrls.filter((url) => /\.(mp4|mov|webm|mkv)(\?|$)/i.test(url)),
    capturedAt: body.meta?.capturedAt ?? new Date().toISOString(),
    capturedByUserId: body.meta?.capturedByUserId ?? userId,
  };

  const note = await prisma.continuityNote.create({
    data: {
      projectId,
      sceneId: body.sceneId ?? null,
      shootDayId: body.shootDayId ?? null,
      body: composeContinuityBody(body.body, mergedMeta),
      photoUrls: toJsonMedia(photoUrls),
      createdById: userId,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        sceneId?: string | null;
        shootDayId?: string | null;
        body?: string;
        photoUrls?: string | string[];
        meta?: Partial<ContinuityMeta>;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.continuityNote.findFirst({
    where: { id: body.id, projectId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Continuity note not found" }, { status: 404 });
  }

  const parsed = parseContinuityBody(existing.body);
  const prevUrls = parseMediaString(existing.photoUrls);
  const nextUrls =
    body.photoUrls === undefined
      ? prevUrls
      : typeof body.photoUrls === "string"
        ? parseMediaString(body.photoUrls)
        : (body.photoUrls ?? []).filter(Boolean);
  const nextMeta: ContinuityMeta = {
    ...parsed.meta,
    ...(body.meta ?? {}),
    linkedImageUrls:
      body.meta?.linkedImageUrls ?? parsed.meta.linkedImageUrls ?? nextUrls.filter((url) => !/\.(mp4|mov|webm|mkv)(\?|$)/i.test(url)),
    linkedVideoUrls:
      body.meta?.linkedVideoUrls ?? parsed.meta.linkedVideoUrls ?? nextUrls.filter((url) => /\.(mp4|mov|webm|mkv)(\?|$)/i.test(url)),
  };

  const note = await prisma.continuityNote.update({
    where: { id: body.id },
    data: {
      ...(body.sceneId !== undefined ? { sceneId: body.sceneId } : {}),
      ...(body.shootDayId !== undefined ? { shootDayId: body.shootDayId } : {}),
      ...(body.body !== undefined || body.meta !== undefined
        ? { body: composeContinuityBody(body.body ?? parsed.plain, nextMeta) }
        : {}),
      ...(body.photoUrls !== undefined ? { photoUrls: toJsonMedia(nextUrls) } : {}),
    },
  });

  return NextResponse.json({ note });
}
