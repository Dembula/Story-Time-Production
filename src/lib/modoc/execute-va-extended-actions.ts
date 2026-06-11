import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { executeScriptBreakdown } from "@/lib/modoc/execute-breakdown";
import { buildCallSheetPayload, snapshotToJsonStrings } from "@/lib/call-sheet-builder";
import type { ModocActionPayload, ModocActionType } from "./action-types";
import type { ModocActionResult } from "./actions";
import { vaGenerateSmartBudget } from "./va-smart-budget";

function requireProjectId(payload: ModocActionPayload): string | ModocActionResult {
  if (!payload.projectId) {
    return { ok: false, error: "projectId is required", status: 400 };
  }
  return payload.projectId;
}

async function accessProject(projectId: string): Promise<ModocActionResult | null> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  return null;
}

/** Extended creator-dashboard actions beyond core breakdown/tasks/calendar. */
export async function executeExtendedModocAction(
  userId: string,
  action: ModocActionType,
  payload: ModocActionPayload,
): Promise<ModocActionResult | null> {
  switch (action) {
    case "auto_populate_breakdown": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const mode = payload.mode === "scenes" ? "scenes" : "full";
      const result = await executeScriptBreakdown(projectId, mode);
      if (!result.ok) return { ok: false, error: result.error, status: result.status ?? 500 };
      return {
        ok: true,
        message: `Auto-populated breakdown (${mode}).${result.warnings.length ? ` Notes: ${result.warnings.slice(0, 3).join("; ")}` : ""}`,
        data: { warnings: result.warnings },
      };
    }

    case "generate_smart_budget": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      return vaGenerateSmartBudget(projectId, payload, userId);
    }

    case "add_breakdown_location": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      if (!payload.name?.trim()) return { ok: false, error: "name is required", status: 400 };
      const loc = await prisma.breakdownLocation.create({
        data: {
          projectId,
          name: payload.name.trim(),
          description: payload.description ?? null,
          sceneId: payload.sceneId ?? null,
          locationListingId: payload.locationListingId ?? null,
        },
      });
      return { ok: true, message: `Breakdown location "${payload.name}" added.`, data: { locationId: loc.id } };
    }

    case "link_location_to_marketplace": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      if (!payload.breakdownLocationId && !payload.name) {
        return { ok: false, error: "breakdownLocationId or name required", status: 400 };
      }
      const listing = payload.locationListingId
        ? await prisma.locationListing.findUnique({ where: { id: payload.locationListingId } })
        : null;
      if (!listing && !payload.locationListingId) {
        return { ok: false, error: "locationListingId required", status: 400 };
      }
      const loc = payload.breakdownLocationId
        ? await prisma.breakdownLocation.findFirst({
            where: { id: payload.breakdownLocationId, projectId },
          })
        : await prisma.breakdownLocation.findFirst({
            where: { projectId, name: payload.name!.trim() },
          });
      if (!loc) return { ok: false, error: "Breakdown location not found", status: 404 };
      await prisma.breakdownLocation.update({
        where: { id: loc.id },
        data: {
          locationListingId: payload.locationListingId!,
          marketplaceLinkedAt: new Date(),
          marketplaceLinkedBy: "VA",
          marketplaceMatchNote: listing
            ? `Linked to "${listing.name}"${listing.city ? ` (${listing.city})` : ""}`
            : null,
        },
      });
      return {
        ok: true,
        message: `Linked "${loc.name}" to marketplace listing "${listing?.name ?? payload.locationListingId}".`,
        data: { breakdownLocationId: loc.id, locationListingId: payload.locationListingId },
      };
    }

    case "add_equipment_plan_item": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      if (!payload.category?.trim()) return { ok: false, error: "category is required", status: 400 };
      const item = await prisma.equipmentPlanItem.create({
        data: {
          projectId,
          department: payload.department ?? null,
          category: payload.category.trim(),
          description: payload.description ?? null,
          quantity: payload.quantity ?? 1,
          equipmentListingId: payload.equipmentListingId ?? null,
          notes: payload.notes ?? null,
        },
      });
      return { ok: true, message: `Equipment plan item "${payload.category}" added.`, data: { itemId: item.id } };
    }

    case "create_table_read_session": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const session = await prisma.tableReadSession.create({
        data: {
          projectId,
          name: payload.title ?? payload.name ?? "Table read session",
          scheduledAt: payload.date || payload.startAt ? new Date(payload.date ?? payload.startAt!) : null,
          createdById: userId,
        },
      });
      return { ok: true, message: `Table read session "${session.name ?? "created"}" scheduled.`, data: { sessionId: session.id } };
    }

    case "generate_call_sheet": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      if (!payload.shootDayId) return { ok: false, error: "shootDayId is required", status: 400 };
      const built = await buildCallSheetPayload(projectId, payload.shootDayId);
      if (!built) return { ok: false, error: "Shoot day not found", status: 404 };
      const snap = snapshotToJsonStrings(built);
      const versionAgg = await prisma.callSheet.aggregate({
        where: { projectId, shootDayId: payload.shootDayId },
        _max: { version: true },
      });
      const callSheet = await prisma.callSheet.create({
        data: {
          projectId,
          shootDayId: payload.shootDayId,
          version: (versionAgg._max.version ?? 0) + 1,
          title: payload.title ?? null,
          notes: payload.notes ?? null,
          castJson: snap.castJson,
          crewJson: snap.crewJson,
          locationsJson: snap.locationsJson,
          scheduleJson: snap.scheduleJson,
        },
      });
      return {
        ok: true,
        message: `Call sheet v${callSheet.version} saved for shoot day.`,
        data: { callSheetId: callSheet.id },
      };
    }

    case "create_project_idea": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const idea = await prisma.projectIdea.create({
        data: {
          projectId,
          userId,
          title: payload.title ?? "New idea",
          logline: payload.logline ?? null,
          notes: payload.notes ?? null,
          genres: payload.genres ?? null,
        },
      });
      return { ok: true, message: `Idea "${idea.title}" created.`, data: { ideaId: idea.id } };
    }

    case "auto_schedule_shoot_days": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const sceneCount = await prisma.projectScene.count({ where: { projectId } });
      const count = payload.quantity ?? Math.max(1, Math.ceil(sceneCount / 6));
      const ids: string[] = [];
      const start = payload.date ? new Date(payload.date) : new Date();
      for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const day = await prisma.shootDay.create({
          data: { projectId, date: d, status: "PLANNED" },
        });
        ids.push(day.id);
      }
      return {
        ok: true,
        message: `Created ${ids.length} shoot day(s) starting ${start.toLocaleDateString()}.`,
        data: { shootDayIds: ids },
      };
    }

    case "add_risk_checklist_item": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      if (!payload.description?.trim()) return { ok: false, error: "description is required", status: 400 };
      let plan = await prisma.riskPlan.findUnique({ where: { projectId } });
      if (!plan) {
        plan = await prisma.riskPlan.create({ data: { projectId } });
      }
      const item = await prisma.riskChecklistItem.create({
        data: {
          planId: plan.id,
          category: payload.department ?? payload.category ?? "GENERAL",
          description: payload.description.trim(),
          status: "OPEN",
        },
      });
      return { ok: true, message: "Risk checklist item added.", data: { itemId: item.id } };
    }

    case "create_incident_report": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      if (!payload.title?.trim() || !payload.description?.trim()) {
        return { ok: false, error: "title and description are required", status: 400 };
      }
      const incident = await prisma.incidentReport.create({
        data: {
          projectId,
          title: payload.title.trim(),
          description: payload.description.trim(),
          severity: payload.severity ?? "MEDIUM",
          shootDayId: payload.shootDayId ?? null,
          createdById: userId,
        },
      });
      return { ok: true, message: `Incident report "${payload.title}" logged.`, data: { incidentId: incident.id } };
    }

    case "update_funding_details": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const funding = await prisma.fundingRequest.upsert({
        where: { projectId },
        create: {
          projectId,
          option: payload.fundingOption === "HAS_FUNDING" ? "HAS_FUNDING" : "REQUEST_FUNDING",
          amount: payload.amount ?? null,
          currency: "ZAR",
          details: payload.notes ?? payload.description ?? null,
          status: "PENDING",
        },
        update: {
          amount: payload.amount ?? undefined,
          details: payload.notes ?? payload.description ?? undefined,
          ...(payload.fundingOption
            ? { option: payload.fundingOption === "HAS_FUNDING" ? "HAS_FUNDING" : "REQUEST_FUNDING" }
            : {}),
        },
      });
      return {
        ok: true,
        message: `Funding record updated${funding.amount != null ? ` — target R${funding.amount.toLocaleString("en-ZA")}` : ""}.`,
        data: { fundingId: funding.id },
      };
    }

    case "populate_risk_checklist": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const { defaultRiskChecklistTemplates } = await import("@/lib/risk-insurance-db");
      let plan = await prisma.riskPlan.findUnique({ where: { projectId } });
      if (!plan) {
        plan = await prisma.riskPlan.create({ data: { projectId } });
      }
      const templates = defaultRiskChecklistTemplates();
      let created = 0;
      for (const tpl of templates) {
        const exists = await prisma.riskChecklistItem.findFirst({
          where: { planId: plan.id, description: tpl.name },
        });
        if (exists) continue;
        await prisma.riskChecklistItem.create({
          data: {
            planId: plan.id,
            category: tpl.category,
            description: tpl.name,
            status: "OPEN",
          },
        });
        created++;
      }
      return {
        ok: true,
        message: `Added ${created} starter risk checklist item(s).`,
        data: { created },
      };
    }

    case "add_continuity_note": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const body = payload.description ?? payload.notes ?? payload.title;
      if (!body?.trim()) return { ok: false, error: "description or notes required", status: 400 };
      const note = await prisma.continuityNote.create({
        data: {
          projectId,
          body: body.trim(),
          sceneId: payload.sceneId ?? null,
          shootDayId: payload.shootDayId ?? null,
          createdById: userId,
        },
      });
      return { ok: true, message: "Continuity note saved.", data: { noteId: note.id } };
    }

    case "sync_starter_crew_needs": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const roles = [
        { role: "Director", department: "Production" },
        { role: "Director of Photography", department: "Camera" },
        { role: "1st AD", department: "Production" },
        { role: "Production Designer", department: "Art" },
        { role: "Sound Recordist", department: "Sound" },
        { role: "Gaffer", department: "Lighting" },
      ];
      let created = 0;
      for (const r of roles) {
        const exists = await prisma.crewRoleNeed.findFirst({
          where: { projectId, role: r.role },
        });
        if (exists) continue;
        await prisma.crewRoleNeed.create({
          data: { projectId, role: r.role, department: r.department, notes: "Starter pack (VA)" },
        });
        created++;
      }
      return { ok: true, message: `Added ${created} crew need(s) to the project.`, data: { created } };
    }

    case "complete_project_task": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      if (!payload.taskId && !payload.title) {
        return { ok: false, error: "taskId or title required", status: 400 };
      }
      const task = payload.taskId
        ? await prisma.projectTask.findFirst({ where: { id: payload.taskId, projectId } })
        : await prisma.projectTask.findFirst({ where: { projectId, title: payload.title!.trim() } });
      if (!task) return { ok: false, error: "Task not found", status: 404 };
      await prisma.projectTask.update({
        where: { id: task.id },
        data: { status: "DONE" },
      });
      return { ok: true, message: `Task "${task.title}" marked done.`, data: { taskId: task.id } };
    }

    case "update_project_phase": {
      const projectId = requireProjectId(payload);
      if (typeof projectId !== "string") return projectId;
      const denied = await accessProject(projectId);
      if (denied) return denied;
      const phase = payload.phase ?? payload.status;
      if (!phase) return { ok: false, error: "phase or status required", status: 400 };
      const project = await prisma.originalProject.update({
        where: { id: projectId },
        data: {
          phase: phase as string,
          ...(payload.status ? { status: payload.status as string } : {}),
        },
        select: { title: true, phase: true, status: true },
      });
      return {
        ok: true,
        message: `Project "${project.title}" updated to phase ${project.phase}.`,
        data: { phase: project.phase, status: project.status },
      };
    }

    default:
      return null;
  }
}
