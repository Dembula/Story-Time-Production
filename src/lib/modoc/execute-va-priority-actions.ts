import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import type { ModocActionPayload, ModocActionType } from "./action-types";
import type { ModocActionResult } from "./actions";

const TASK_META_START = "[ST_TASK_META]";
const TASK_META_END = "[/ST_TASK_META]";

type LinkedItemType =
  | "SCENE"
  | "PRODUCTION_DAY"
  | "CAST"
  | "CREW"
  | "LOCATION"
  | "EQUIPMENT"
  | "CONTRACT"
  | "FUNDING"
  | "OTHER";

function requireProjectId(payload: ModocActionPayload): string | ModocActionResult {
  if (!payload.projectId) return { ok: false, error: "projectId is required", status: 400 };
  return payload.projectId;
}

function locationKeyFromScene(scene: {
  heading: string | null;
  primaryLocation: { name: string } | null;
  breakdownLocations: Array<{ name: string }>;
}): string {
  if (scene.primaryLocation?.name?.trim()) return scene.primaryLocation.name.trim();
  if (scene.breakdownLocations[0]?.name?.trim()) return scene.breakdownLocations[0].name.trim();
  const heading = scene.heading ?? "";
  const slug = heading.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, "").split("-")[0]?.trim();
  return slug || "General / Studio";
}

/** Group scenes onto shoot days by location; create days if needed. */
async function vaAssignScenesByLocation(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const scenes = await prisma.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      heading: true,
      primaryLocation: { select: { name: true } },
      breakdownLocations: { select: { name: true }, take: 1 },
    },
  });

  if (scenes.length === 0) {
    return { ok: false, error: "No scenes to schedule — sync scenes from script first.", status: 400 };
  }

  const groups = new Map<string, string[]>();
  for (const scene of scenes) {
    const key = locationKeyFromScene(scene);
    const list = groups.get(key) ?? [];
    list.push(scene.id);
    groups.set(key, list);
  }

  let shootDays = await prisma.shootDay.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
  });

  const groupEntries = [...groups.entries()];
  const start = payload.date ? new Date(payload.date) : new Date();

  while (shootDays.length < groupEntries.length) {
    const d = new Date(start);
    d.setDate(d.getDate() + shootDays.length);
    const day = await prisma.shootDay.create({
      data: { projectId, date: d, status: "PLANNED" },
    });
    shootDays.push(day);
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < groupEntries.length; i++) {
      const [locName, sceneIds] = groupEntries[i];
      const day = shootDays[i];
      await tx.shootDay.update({
        where: { id: day.id },
        data: { locationSummary: locName },
      });
      await tx.shootDayScene.deleteMany({ where: { shootDayId: day.id } });
      if (sceneIds.length > 0) {
        await tx.shootDayScene.createMany({
          data: sceneIds.map((sceneId, order) => ({
            shootDayId: day.id,
            sceneId,
            order,
          })),
        });
      }
    }
  });

  return {
    ok: true,
    message: `Scheduled ${scenes.length} scene(s) across ${groupEntries.length} shoot day(s), grouped by location.`,
    data: {
      shootDayIds: shootDays.slice(0, groupEntries.length).map((d) => d.id),
      locationGroups: groupEntries.map(([name, ids]) => ({ name, sceneCount: ids.length })),
    },
  };
}

async function vaAssignScenesToShootDay(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  if (!payload.shootDayId) return { ok: false, error: "shootDayId is required", status: 400 };

  const day = await prisma.shootDay.findFirst({ where: { id: payload.shootDayId, projectId } });
  if (!day) return { ok: false, error: "Shoot day not found", status: 404 };

  const sceneIds =
    payload.sceneId != null
      ? [payload.sceneId]
      : payload.description?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  if (sceneIds.length === 0) {
    const allScenes = await prisma.projectScene.findMany({
      where: { projectId },
      select: { id: true },
      orderBy: { number: "asc" },
    });
    sceneIds.push(...allScenes.map((s) => s.id));
  }

  await prisma.$transaction(async (tx) => {
    await tx.shootDayScene.deleteMany({ where: { shootDayId: day.id } });
    if (sceneIds.length > 0) {
      await tx.shootDayScene.createMany({
        data: sceneIds.map((sceneId, order) => ({
          shootDayId: day.id,
          sceneId,
          order,
        })),
      });
    }
  });

  return {
    ok: true,
    message: `Assigned ${sceneIds.length} scene(s) to shoot day ${day.date.toLocaleDateString()}.`,
    data: { shootDayId: day.id, sceneIds },
  };
}

async function vaBookLocation(
  userId: string,
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const locationId = payload.locationListingId ?? payload.locationId;
  if (!locationId) return { ok: false, error: "locationListingId is required", status: 400 };

  const listing = await prisma.locationListing.findUnique({
    where: { id: locationId },
    select: { id: true, name: true, companyId: true, city: true },
  });
  if (!listing?.companyId) {
    return { ok: false, error: "Location not found or has no owner", status: 400 };
  }

  const booking = await prisma.locationBooking.create({
    data: {
      locationId: listing.id,
      requesterId: userId,
      ownerId: listing.companyId,
      note: payload.notes ?? payload.description ?? `Booking for project ${projectId}`,
      shootType: payload.template ?? null,
      startDate: payload.startAt ?? payload.date ?? null,
      endDate: payload.endAt ?? null,
    },
  });

  return {
    ok: true,
    message: `Location booking request sent for "${listing.name}"${listing.city ? ` (${listing.city})` : ""}.`,
    data: { bookingId: booking.id, locationListingId: listing.id },
  };
}

async function vaRequestEquipment(
  userId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const equipmentId = payload.equipmentListingId ?? payload.equipmentId;
  if (!equipmentId) return { ok: false, error: "equipmentListingId is required", status: 400 };

  const equipment = await prisma.equipmentListing.findUnique({
    where: { id: equipmentId },
    select: { id: true, companyName: true, companyId: true },
  });
  if (!equipment?.companyId) {
    return { ok: false, error: "Equipment listing not found or has no company", status: 400 };
  }

  const request = await prisma.equipmentRequest.create({
    data: {
      equipmentId: equipment.id,
      requesterId: userId,
      companyId: equipment.companyId,
      note: payload.notes ?? payload.description ?? null,
      startDate: payload.startAt ?? payload.date ?? null,
      endDate: payload.endAt ?? null,
    },
  });

  return {
    ok: true,
    message: `Equipment request sent to ${equipment.companyName}.`,
    data: { requestId: request.id, equipmentListingId: equipment.id },
  };
}

async function vaInviteCasting(
  userId: string,
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  let roleId = payload.roleId;
  if (!roleId && payload.name) {
    const role = await prisma.castingRole.findFirst({
      where: { projectId, name: payload.name.trim() },
    });
    roleId = role?.id;
  }
  if (!roleId) return { ok: false, error: "roleId or casting role name is required", status: 400 };

  const role = await prisma.castingRole.findFirst({ where: { id: roleId, projectId } });
  if (!role) return { ok: false, error: "Casting role not found", status: 404 };

  const invitation = await prisma.castingInvitation.create({
    data: {
      projectId,
      roleId: role.id,
      creatorId: userId,
      castingAgencyId: payload.castingAgencyId ?? null,
      talentId: payload.talentId ?? null,
      message: payload.message ?? payload.notes ?? payload.description ?? null,
    },
  });

  return {
    ok: true,
    message: `Casting invitation sent for role "${role.name}".`,
    data: { invitationId: invitation.id, roleId: role.id },
  };
}

async function vaInviteCrew(
  userId: string,
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  let needId = payload.needId ?? payload.taskId;
  if (!needId && payload.role) {
    const need = await prisma.crewRoleNeed.findFirst({
      where: { projectId, role: payload.role.trim() },
    });
    needId = need?.id;
  }
  if (!needId) return { ok: false, error: "needId or crew role name is required", status: 400 };

  const need = await prisma.crewRoleNeed.findFirst({ where: { id: needId, projectId } });
  if (!need) return { ok: false, error: "Crew need not found", status: 404 };

  const invitation = await prisma.crewInvitation.create({
    data: {
      projectId,
      needId: need.id,
      creatorId: userId,
      crewTeamId: payload.crewTeamId ?? null,
      crewMemberId: payload.crewMemberId ?? null,
      message: payload.message ?? payload.notes ?? payload.description ?? null,
    },
  });

  return {
    ok: true,
    message: `Crew invitation sent for "${need.role}".`,
    data: { invitationId: invitation.id, needId: need.id },
  };
}

async function vaUpdateShootProgress(
  userId: string,
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  if (!payload.shootDayId) return { ok: false, error: "shootDayId is required", status: 400 };

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: payload.shootDayId, projectId },
    include: { scenes: true },
  });
  if (!shootDay) return { ok: false, error: "Shoot day not found", status: 404 };

  if (payload.status && !payload.sceneId) {
    await prisma.shootDay.update({
      where: { id: shootDay.id },
      data: { status: payload.status },
    });
    return {
      ok: true,
      message: `Shoot day marked ${payload.status}.`,
      data: { shootDayId: shootDay.id },
    };
  }

  if (!payload.sceneId) {
    return { ok: false, error: "sceneId required to update scene progress", status: 400 };
  }

  const link = shootDay.scenes.find((s) => s.sceneId === payload.sceneId);
  if (!link) {
    return { ok: false, error: "Scene not assigned to this shoot day", status: 404 };
  }

  await prisma.shootDayControlBoard.upsert({
    where: { shootDayId: shootDay.id },
    create: { shootDayId: shootDay.id, projectId },
    update: {},
  });

  const board = await prisma.shootDayControlBoard.findUnique({ where: { shootDayId: shootDay.id } });
  const sceneProgress = (board?.sceneProgress as Record<string, unknown> | null) ?? {};
  const current = (sceneProgress[link.id] as Record<string, unknown> | undefined) ?? {};
  const status = payload.status ?? "IN_PROGRESS";
  const next = {
    ...current,
    status,
    manualStatus: status,
    notes: payload.notes ?? payload.description ?? current.notes ?? null,
    completionPercent:
      payload.completionPercent ??
      (status === "COMPLETED" ? 100 : status === "IN_PROGRESS" ? 50 : 0),
    manualUpdatedAt: new Date().toISOString(),
    manualUpdatedByUserId: userId,
  };

  await prisma.shootDayControlBoard.update({
    where: { shootDayId: shootDay.id },
    data: {
      sceneProgress: { ...sceneProgress, [link.id]: next } as Prisma.InputJsonValue,
    },
  });

  return {
    ok: true,
    message: `Scene progress updated on shoot day (${status}).`,
    data: { shootDayId: shootDay.id, sceneId: payload.sceneId },
  };
}

async function vaCreateDailiesBatch(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const batch = await prisma.dailiesBatch.create({
    data: {
      projectId,
      sceneId: payload.sceneId ?? null,
      shootDayId: payload.shootDayId ?? null,
      title: payload.title ?? "Dailies batch",
      videoUrl: payload.fileUrl ?? null,
      notes: payload.notes ?? payload.description ?? null,
    },
  });

  return {
    ok: true,
    message: `Dailies batch "${batch.title ?? "created"}" saved.`,
    data: { batchId: batch.id },
  };
}

async function vaAddDailiesNote(
  userId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const batchId = payload.batchId ?? payload.taskId;
  if (!batchId) return { ok: false, error: "batchId is required", status: 400 };
  const body = payload.notes ?? payload.description;
  if (!body?.trim()) return { ok: false, error: "notes or description required", status: 400 };

  const note = await prisma.dailiesNote.create({
    data: { batchId, userId, body: body.trim() },
  });

  return { ok: true, message: "Dailies note added.", data: { noteId: note.id } };
}

function composeAutoTaskDescription(title: string, meta: Record<string, unknown>): string {
  return `${title}\n\n${TASK_META_START}\n${JSON.stringify(meta)}\n${TASK_META_END}`;
}

async function vaSyncProductionWorkspaceTasks(
  userId: string,
  projectId: string,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const [scenes, shootDays, locations, equipment, castRoles, riskItems] = await Promise.all([
    prisma.projectScene.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
      take: 20,
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: { id: true, date: true },
      take: 20,
    }),
    prisma.breakdownLocation.findMany({
      where: { projectId },
      select: { id: true, name: true },
      take: 20,
    }),
    prisma.equipmentPlanItem.findMany({
      where: { projectId },
      select: { id: true, category: true, quantity: true },
      take: 20,
    }),
    prisma.castingRole.findMany({
      where: { projectId, status: "CAST" },
      select: { id: true, name: true },
      take: 20,
    }),
    prisma.riskChecklistItem.findMany({
      where: { plan: { projectId }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true, description: true },
      take: 20,
    }),
  ]);

  const existing = await prisma.projectTask.findMany({
    where: { projectId },
    select: { description: true },
  });
  const existingKeys = new Set<string>();
  for (const t of existing) {
    const m = t.description?.match(/\[ST_TASK_META\]\s*(\{[\s\S]*?\})\s*\[\/ST_TASK_META\]/);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]) as { autoTaskKey?: string };
        if (parsed.autoTaskKey) existingKeys.add(parsed.autoTaskKey);
      } catch {
        /* skip */
      }
    }
  }

  type Candidate = {
    key: string;
    title: string;
    department: string;
    linkedItemType: LinkedItemType;
    linkedItemId: string;
    linkedItemLabel: string;
    shootDayId?: string;
    sceneId?: string;
  };

  const candidates: Candidate[] = [];
  for (const scene of scenes) {
    candidates.push({
      key: `scene-prep-${scene.id}`,
      title: `Prep Scene ${scene.number} for shoot`,
      department: "Production",
      linkedItemType: "SCENE",
      linkedItemId: scene.id,
      linkedItemLabel: `Scene ${scene.number}`,
      sceneId: scene.id,
    });
  }
  shootDays.forEach((day, idx) => {
    candidates.push({
      key: `day-brief-${day.id}`,
      title: `Daily briefing — Day ${idx + 1}`,
      department: "Production",
      linkedItemType: "PRODUCTION_DAY",
      linkedItemId: day.id,
      linkedItemLabel: day.date.toISOString().slice(0, 10),
      shootDayId: day.id,
    });
  });
  for (const loc of locations) {
    candidates.push({
      key: `location-${loc.id}`,
      title: `Confirm logistics: ${loc.name}`,
      department: "Locations",
      linkedItemType: "LOCATION",
      linkedItemId: loc.id,
      linkedItemLabel: loc.name,
    });
  }
  for (const item of equipment) {
    candidates.push({
      key: `equip-${item.id}`,
      title: `Prep ${item.category} (×${item.quantity})`,
      department: "Camera",
      linkedItemType: "EQUIPMENT",
      linkedItemId: item.id,
      linkedItemLabel: item.category,
    });
  }
  for (const role of castRoles) {
    candidates.push({
      key: `cast-${role.id}`,
      title: `Rehearsal touchpoint: ${role.name}`,
      department: "Casting",
      linkedItemType: "CAST",
      linkedItemId: role.id,
      linkedItemLabel: role.name,
    });
  }
  for (const risk of riskItems) {
    candidates.push({
      key: `risk-${risk.id}`,
      title: `Close risk item: ${risk.description.slice(0, 60)}`,
      department: "Safety",
      linkedItemType: "OTHER",
      linkedItemId: risk.id,
      linkedItemLabel: risk.description.slice(0, 40),
    });
  }

  let created = 0;
  for (const c of candidates) {
    if (existingKeys.has(c.key)) continue;
    await prisma.projectTask.create({
      data: {
        projectId,
        title: c.title,
        description: composeAutoTaskDescription(c.title, {
          autoTaskKey: c.key,
          linkedItemType: c.linkedItemType,
          linkedItemId: c.linkedItemId,
          linkedItemLabel: c.linkedItemLabel,
        }),
        department: c.department,
        priority: "MEDIUM",
        status: "TODO",
        shootDayId: c.shootDayId ?? null,
        sceneId: c.sceneId ?? null,
        createdById: userId,
      },
    });
    created++;
  }

  return {
    ok: true,
    message: `Production workspace sync: ${created} new task(s) from schedule, locations, cast, equipment, and risk.`,
    data: { created },
  };
}

async function vaAddMusicSelection(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  if (!payload.trackId) return { ok: false, error: "trackId is required", status: 400 };

  const track = await prisma.musicTrack.findUnique({ where: { id: payload.trackId } });
  if (!track) return { ok: false, error: "Music track not found", status: 404 };

  const selection = await prisma.musicSelection.create({
    data: {
      projectId,
      trackId: track.id,
      usage: payload.category ?? payload.template ?? null,
      notes: payload.notes ?? payload.description ?? null,
    },
  });

  return {
    ok: true,
    message: `Music track "${track.title}" added to project.`,
    data: { selectionId: selection.id, trackId: track.id },
  };
}

async function vaCreateFootageAsset(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  if (!payload.fileUrl?.trim()) {
    return { ok: false, error: "fileUrl is required for footage ingest", status: 400 };
  }

  const asset = await prisma.footageAsset.create({
    data: {
      projectId,
      sceneId: payload.sceneId ?? null,
      type: payload.category ?? payload.template ?? "RAW",
      label: payload.title ?? payload.name ?? null,
      fileUrl: payload.fileUrl.trim(),
      metadata: payload.notes ?? payload.description ?? null,
    },
  });

  return {
    ok: true,
    message: `Footage asset "${asset.label ?? asset.type}" registered.`,
    data: { assetId: asset.id },
  };
}

async function vaSubmitDistribution(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const target = payload.target ?? payload.title ?? payload.name;
  if (!target?.trim()) return { ok: false, error: "target is required", status: 400 };

  const submission = await prisma.distributionSubmission.create({
    data: {
      projectId,
      target: target.trim(),
      territories: payload.department ?? payload.genres ?? null,
      rights: payload.description ?? null,
      note: payload.notes ?? null,
      status: "PENDING",
    },
  });

  return {
    ok: true,
    message: `Distribution submission created for "${target}".`,
    data: { submissionId: submission.id },
  };
}

/** Priority-gap VA actions: scheduling depth, marketplace, production, post. */
export async function executePriorityModocAction(
  userId: string,
  action: ModocActionType,
  payload: ModocActionPayload,
): Promise<ModocActionResult | null> {
  switch (action) {
    case "assign_scenes_by_location": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaAssignScenesByLocation(projectId, payload);
    }
    case "assign_scenes_to_shoot_day": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaAssignScenesToShootDay(projectId, payload);
    }
    case "book_location": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaBookLocation(userId, projectId, payload);
    }
    case "request_equipment": {
      if (!payload.projectId) return { ok: false, error: "projectId is required", status: 400 };
      return vaRequestEquipment(userId, payload);
    }
    case "invite_casting_talent": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaInviteCasting(userId, projectId, payload);
    }
    case "invite_crew_team": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaInviteCrew(userId, projectId, payload);
    }
    case "update_shoot_progress": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaUpdateShootProgress(userId, projectId, payload);
    }
    case "create_dailies_batch": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaCreateDailiesBatch(projectId, payload);
    }
    case "add_dailies_note": {
      return vaAddDailiesNote(userId, payload);
    }
    case "sync_production_workspace_tasks": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaSyncProductionWorkspaceTasks(userId, projectId);
    }
    case "add_music_selection": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaAddMusicSelection(projectId, payload);
    }
    case "create_footage_asset": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaCreateFootageAsset(projectId, payload);
    }
    case "submit_distribution": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaSubmitDistribution(projectId, payload);
    }
    default:
      return null;
  }
}
