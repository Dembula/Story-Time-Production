import { prisma } from "@/lib/prisma";

export type CallSheetCastRow = {
  characterName: string;
  roleName: string;
  talentName: string | null;
  invitationStatus: string | null;
};

export type CallSheetLocationRow = {
  name: string;
  description: string | null;
  source: "day_summary" | "scene_primary" | "breakdown";
};

export type CallSheetScheduleRow = {
  order: number;
  sceneNumber: string;
  heading: string | null;
};

/** Build call sheet JSON snapshots from shoot day + scenes + breakdown + casting. */
export async function buildCallSheetPayload(projectId: string, shootDayId: string) {
  const day = await prisma.shootDay.findFirst({
    where: { id: shootDayId, projectId },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: {
          scene: {
            include: {
              breakdownCharacters: { orderBy: { name: "asc" } },
              breakdownLocations: { orderBy: { name: "asc" } },
              primaryLocation: true,
            },
          },
        },
      },
    },
  });

  if (!day) {
    return null;
  }

  const characterIds = new Set<string>();
  const schedule: CallSheetScheduleRow[] = [];
  const locationMap = new Map<string, CallSheetLocationRow>();

  if (day.locationSummary?.trim()) {
    const key = day.locationSummary.trim().toLowerCase();
    locationMap.set(key, {
      name: day.locationSummary.trim(),
      description: null,
      source: "day_summary",
    });
  }

  for (const link of day.scenes) {
    const sc = link.scene;
    if (!sc) continue;
    schedule.push({
      order: link.order,
      sceneNumber: sc.number,
      heading: sc.heading,
    });
    for (const ch of sc.breakdownCharacters) {
      characterIds.add(ch.id);
    }
    if (sc.primaryLocation) {
      const pl = sc.primaryLocation;
      const key = pl.id;
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          name: pl.name,
          description: pl.description,
          source: "scene_primary",
        });
      }
    }
    for (const loc of sc.breakdownLocations) {
      const key = `bd-${loc.id}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          name: loc.name,
          description: loc.description,
          source: "breakdown",
        });
      }
    }
  }

  const roles =
    characterIds.size === 0
      ? []
      : await prisma.castingRole.findMany({
          where: {
            projectId,
            breakdownCharacterId: { in: [...characterIds] },
          },
          include: {
            breakdownCharacter: true,
            invitations: { include: { talent: true }, orderBy: { createdAt: "desc" } },
          },
        });

  const roleByCharId = new Map(
    roles.filter((r) => r.breakdownCharacterId).map((r) => [r.breakdownCharacterId!, r]),
  );

  const cast: CallSheetCastRow[] = [];
  const seenChar = new Set<string>();

  for (const link of day.scenes) {
    const sc = link.scene;
    if (!sc) continue;
    for (const ch of sc.breakdownCharacters) {
      if (seenChar.has(ch.id)) continue;
      seenChar.add(ch.id);
      const role = roleByCharId.get(ch.id);
      const accepted = role?.invitations.find((i) => i.status === "ACCEPTED");
      cast.push({
        characterName: ch.name,
        roleName: role?.name ?? ch.name,
        talentName: accepted?.talent?.name ?? null,
        invitationStatus: accepted ? "ACCEPTED" : role?.invitations[0]?.status ?? null,
      });
    }
  }

  const locations = [...locationMap.values()];
  const crew: { role: string; name: string; notes?: string }[] = [];

  const meta = {
    shootDayId: day.id,
    date: day.date.toISOString(),
    unit: day.unit,
    callTime: day.callTime,
    wrapTime: day.wrapTime,
    locationSummary: day.locationSummary,
    dayNotes: day.dayNotes,
    scenesBeingShot: day.scenesBeingShot,
  };

  return {
    meta,
    cast,
    crew,
    locations,
    schedule,
  };
}

export function snapshotToJsonStrings(payload: NonNullable<Awaited<ReturnType<typeof buildCallSheetPayload>>>) {
  return {
    castJson: JSON.stringify(payload.cast),
    crewJson: JSON.stringify(payload.crew),
    locationsJson: JSON.stringify(payload.locations),
    scheduleJson: JSON.stringify({ meta: payload.meta, rows: payload.schedule }),
  };
}
