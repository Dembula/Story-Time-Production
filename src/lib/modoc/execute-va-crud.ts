import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { suggestScriptBreakdownAfterSave } from "@/lib/modoc/proactive";
import type { ModocActionPayload, ModocActionType } from "./action-types";
import type { ModocActionResult } from "./actions";
import { parseVaActionDate, resolveVaProjectId } from "./va-scheduling";

async function projectCtx(
  userId: string,
  payload: ModocActionPayload,
): Promise<{ projectId: string } | ModocActionResult> {
  const projectId = await resolveVaProjectId(userId, payload.projectId);
  if (!projectId) {
    return { ok: false, error: "projectId is required", status: 400 };
  }
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  return { projectId };
}

function fillPayload(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, fillFields: data.fillFields ?? undefined };
}

async function vaUpdateScriptContent(
  userId: string,
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  if (payload.content === undefined && payload.title === undefined && payload.notes === undefined) {
    return { ok: false, error: "content, title, or notes required", status: 400 };
  }

  let script = await prisma.projectScript.findFirst({ where: { projectId } });
  if (!script) {
    script = await prisma.projectScript.create({
      data: { projectId, title: payload.title?.trim() || "Screenplay" },
    });
  } else if (payload.title !== undefined) {
    script = await prisma.projectScript.update({
      where: { id: script.id },
      data: { title: payload.title.trim() || script.title },
    });
  }

  const contentToWrite = payload.content ?? payload.notes;
  if (contentToWrite !== undefined) {
    const append = payload.mode === "append";
    const latest = await prisma.projectScriptVersion.findFirst({
      where: { scriptId: script.id },
      orderBy: { createdAt: "desc" },
    });
    const nextContent = append && latest?.content
      ? `${latest.content.trimEnd()}\n\n${contentToWrite}`
      : contentToWrite;

    if (!latest) {
      const version = await prisma.projectScriptVersion.create({
        data: {
          scriptId: script.id,
          content: nextContent,
          createdById: userId,
          autoSavedAt: new Date(),
        },
      });
      await prisma.projectScript.update({
        where: { id: script.id },
        data: { currentVersionId: version.id },
      });
    } else {
      await prisma.projectScriptVersion.update({
        where: { id: latest.id },
        data: { content: nextContent, autoSavedAt: new Date() },
      });
    }

    void suggestScriptBreakdownAfterSave({
      userId,
      projectId,
      scriptTitle: script.title,
      versionLabel: null,
      versionCount: await prisma.projectScriptVersion.count({ where: { scriptId: script.id } }),
      isNewVersion: false,
    }).catch(() => {});
  }

  return {
    ok: true,
    message: appendModeMessage(payload.mode, "Script"),
    data: fillPayload({
      projectId,
      fillFields: {
        tool: "script-writing",
        mode: payload.mode === "append" ? "append" : "replace",
        content: contentToWrite,
        title: payload.title,
      },
    }),
  };
}

function appendModeMessage(mode: string | undefined, entity: string): string {
  return mode === "append" ? `${entity} content appended.` : `${entity} updated.`;
}

/** Update/delete handlers for creator tools — full CRUD parity with dashboard APIs. */
export async function executeVaCrudAction(
  userId: string,
  action: ModocActionType,
  payload: ModocActionPayload,
): Promise<ModocActionResult | null> {
  switch (action) {
    case "update_script_content":
    case "append_script_content": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      return vaUpdateScriptContent(userId, ctx.projectId, {
        ...payload,
        mode: action === "append_script_content" ? "append" : payload.mode,
      });
    }

    case "update_budget_line": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const lineId = payload.lineId ?? payload.taskId;
      if (!lineId) return { ok: false, error: "lineId required", status: 400 };
      const budget = await prisma.projectBudget.findUnique({ where: { projectId: ctx.projectId } });
      if (!budget) return { ok: false, error: "Budget not found", status: 404 };
      const result = await prisma.projectBudgetLine.updateMany({
        where: { id: lineId, budgetId: budget.id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.department !== undefined ? { department: payload.department } : {}),
          ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
          ...(payload.unitCost !== undefined ? { unitCost: payload.unitCost } : {}),
          ...(payload.total !== undefined ? { total: payload.total } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Budget line not found", status: 404 };
      return { ok: true, message: "Budget line updated.", data: { lineId } };
    }

    case "delete_budget_line": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const lineId = payload.lineId;
      if (!lineId && !payload.name) {
        return { ok: false, error: "lineId or name required", status: 400 };
      }
      const budget = await prisma.projectBudget.findUnique({ where: { projectId: ctx.projectId } });
      if (!budget) return { ok: false, error: "Budget not found", status: 404 };
      const line = lineId
        ? await prisma.projectBudgetLine.findFirst({ where: { id: lineId, budgetId: budget.id } })
        : await prisma.projectBudgetLine.findFirst({
            where: { budgetId: budget.id, name: payload.name!.trim() },
          });
      if (!line) return { ok: false, error: "Budget line not found", status: 404 };
      await prisma.projectBudgetLine.delete({ where: { id: line.id } });
      return { ok: true, message: `Budget line "${line.name}" removed.`, data: { lineId: line.id } };
    }

    case "update_shoot_day": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const shootDayId = payload.shootDayId;
      if (!shootDayId) return { ok: false, error: "shootDayId required", status: 400 };
      const due = parseVaActionDate(payload.date, payload.startAt, payload.dueDate);
      const result = await prisma.shootDay.updateMany({
        where: { id: shootDayId, projectId: ctx.projectId },
        data: {
          ...(due ? { date: due } : {}),
          ...(payload.unit !== undefined ? { unit: payload.unit } : {}),
          ...(payload.callTime !== undefined ? { callTime: payload.callTime } : {}),
          ...(payload.wrapTime !== undefined ? { wrapTime: payload.wrapTime } : {}),
          ...(payload.locationSummary !== undefined ? { locationSummary: payload.locationSummary } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Shoot day not found", status: 404 };
      return { ok: true, message: "Shoot day updated.", data: { shootDayId } };
    }

    case "delete_shoot_day": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const shootDayId = payload.shootDayId;
      if (!shootDayId) return { ok: false, error: "shootDayId required", status: 400 };
      const result = await prisma.shootDay.deleteMany({
        where: { id: shootDayId, projectId: ctx.projectId },
      });
      if (result.count === 0) return { ok: false, error: "Shoot day not found", status: 404 };
      return { ok: true, message: "Shoot day removed.", data: { shootDayId } };
    }

    case "update_casting_role": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const roleId = payload.roleId ?? payload.taskId;
      if (!roleId) return { ok: false, error: "roleId required", status: 400 };
      const result = await prisma.castingRole.updateMany({
        where: { id: roleId, projectId: ctx.projectId },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.role !== undefined ? { name: payload.role } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Casting role not found", status: 404 };
      return { ok: true, message: "Casting role updated.", data: { roleId } };
    }

    case "delete_casting_role": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const roleId = payload.roleId;
      const role = roleId
        ? await prisma.castingRole.findFirst({ where: { id: roleId, projectId: ctx.projectId } })
        : await prisma.castingRole.findFirst({
            where: { projectId: ctx.projectId, name: payload.name?.trim() ?? payload.role?.trim() ?? "" },
          });
      if (!role) return { ok: false, error: "Casting role not found", status: 404 };
      await prisma.castingRole.delete({ where: { id: role.id } });
      return { ok: true, message: `Casting role "${role.name}" removed.`, data: { roleId: role.id } };
    }

    case "update_crew_need": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const needId = payload.needId ?? payload.taskId;
      if (!needId) return { ok: false, error: "needId required", status: 400 };
      const result = await prisma.crewRoleNeed.updateMany({
        where: { id: needId, projectId: ctx.projectId },
        data: {
          ...(payload.department !== undefined ? { department: payload.department } : {}),
          ...(payload.role !== undefined ? { role: payload.role } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Crew need not found", status: 404 };
      return { ok: true, message: "Crew need updated.", data: { needId } };
    }

    case "delete_crew_need": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const need = payload.needId
        ? await prisma.crewRoleNeed.findFirst({ where: { id: payload.needId, projectId: ctx.projectId } })
        : await prisma.crewRoleNeed.findFirst({
            where: { projectId: ctx.projectId, role: payload.role?.trim() ?? "" },
          });
      if (!need) return { ok: false, error: "Crew need not found", status: 404 };
      await prisma.crewRoleNeed.delete({ where: { id: need.id } });
      return { ok: true, message: `Crew need "${need.role}" removed.`, data: { needId: need.id } };
    }

    case "update_equipment_plan_item": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const equipmentId = payload.equipmentId ?? payload.equipmentListingId;
      if (!equipmentId) return { ok: false, error: "equipmentId required", status: 400 };
      const result = await prisma.equipmentPlanItem.updateMany({
        where: { id: equipmentId, projectId: ctx.projectId },
        data: {
          ...(payload.category !== undefined ? { category: payload.category } : {}),
          ...(payload.department !== undefined ? { department: payload.department } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Equipment item not found", status: 404 };
      return { ok: true, message: "Equipment plan item updated.", data: { equipmentId } };
    }

    case "delete_equipment_plan_item": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const item = payload.equipmentId
        ? await prisma.equipmentPlanItem.findFirst({ where: { id: payload.equipmentId, projectId: ctx.projectId } })
        : await prisma.equipmentPlanItem.findFirst({
            where: { projectId: ctx.projectId, category: payload.category?.trim() ?? "" },
          });
      if (!item) return { ok: false, error: "Equipment item not found", status: 404 };
      await prisma.equipmentPlanItem.delete({ where: { id: item.id } });
      return { ok: true, message: `Equipment item "${item.category}" removed.`, data: { equipmentId: item.id } };
    }

    case "update_breakdown_location": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const locId = payload.breakdownLocationId ?? payload.locationId;
      if (!locId) return { ok: false, error: "breakdownLocationId required", status: 400 };
      const result = await prisma.breakdownLocation.updateMany({
        where: { id: locId, projectId: ctx.projectId },
        data: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Breakdown location not found", status: 404 };
      return { ok: true, message: "Breakdown location updated.", data: { breakdownLocationId: locId } };
    }

    case "delete_breakdown_location": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const loc = payload.breakdownLocationId
        ? await prisma.breakdownLocation.findFirst({
            where: { id: payload.breakdownLocationId, projectId: ctx.projectId },
          })
        : await prisma.breakdownLocation.findFirst({
            where: { projectId: ctx.projectId, name: payload.name?.trim() ?? "" },
          });
      if (!loc) return { ok: false, error: "Breakdown location not found", status: 404 };
      await prisma.breakdownLocation.delete({ where: { id: loc.id } });
      return { ok: true, message: `Location "${loc.name}" removed from breakdown.`, data: { breakdownLocationId: loc.id } };
    }

    case "update_production_expense": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      if (!payload.taskId && !payload.title) {
        return { ok: false, error: "expense id (taskId) or title required", status: 400 };
      }
      const expense = payload.taskId
        ? await prisma.productionExpense.findFirst({ where: { id: payload.taskId, projectId: ctx.projectId } })
        : await prisma.productionExpense.findFirst({
            where: { projectId: ctx.projectId, description: payload.title!.trim() },
          });
      if (!expense) return { ok: false, error: "Expense not found", status: 404 };
      await prisma.productionExpense.update({
        where: { id: expense.id },
        data: {
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
          ...(payload.category !== undefined ? { category: payload.category } : {}),
          ...(payload.vendor !== undefined ? { vendor: payload.vendor } : {}),
        },
      });
      return { ok: true, message: "Production expense updated.", data: { expenseId: expense.id } };
    }

    case "delete_production_expense": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const expense = payload.taskId
        ? await prisma.productionExpense.findFirst({ where: { id: payload.taskId, projectId: ctx.projectId } })
        : await prisma.productionExpense.findFirst({
            where: { projectId: ctx.projectId, description: payload.title?.trim() ?? payload.description?.trim() ?? "" },
          });
      if (!expense) return { ok: false, error: "Expense not found", status: 404 };
      await prisma.productionExpense.delete({ where: { id: expense.id } });
      return { ok: true, message: "Production expense removed.", data: { expenseId: expense.id } };
    }

    case "update_incident_report":
    case "resolve_incident_report": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const incidentId = payload.taskId ?? payload.eventId;
      if (!incidentId) return { ok: false, error: "incident id required", status: 400 };
      const result = await prisma.incidentReport.updateMany({
        where: { id: incidentId, projectId: ctx.projectId },
        data: {
          ...(action === "resolve_incident_report" ? { resolved: true, resolvedAt: new Date() } : {}),
          ...(payload.resolved === true ? { resolved: true, resolvedAt: new Date() } : {}),
          ...(payload.title !== undefined ? { title: payload.title } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Incident not found", status: 404 };
      return {
        ok: true,
        message: action === "resolve_incident_report" ? "Incident marked resolved." : "Incident updated.",
        data: { incidentId },
      };
    }

    case "delete_incident_report": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const incident = payload.taskId
        ? await prisma.incidentReport.findFirst({ where: { id: payload.taskId, projectId: ctx.projectId } })
        : await prisma.incidentReport.findFirst({
            where: { projectId: ctx.projectId, title: payload.title?.trim() ?? "" },
          });
      if (!incident) return { ok: false, error: "Incident not found", status: 404 };
      await prisma.incidentReport.delete({ where: { id: incident.id } });
      return { ok: true, message: `Incident "${incident.title}" removed.`, data: { incidentId: incident.id } };
    }

    case "update_continuity_note": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const noteId = payload.taskId ?? payload.eventId;
      if (!noteId) return { ok: false, error: "note id required", status: 400 };
      const result = await prisma.continuityNote.updateMany({
        where: { id: noteId, projectId: ctx.projectId },
        data: {
          ...(payload.description !== undefined ? { body: payload.description } : {}),
          ...(payload.notes !== undefined ? { body: payload.notes } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Continuity note not found", status: 404 };
      return { ok: true, message: "Continuity note updated.", data: { noteId } };
    }

    case "delete_continuity_note": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const note = payload.taskId
        ? await prisma.continuityNote.findFirst({ where: { id: payload.taskId, projectId: ctx.projectId } })
        : null;
      if (!note) return { ok: false, error: "Continuity note not found", status: 404 };
      await prisma.continuityNote.delete({ where: { id: note.id } });
      return { ok: true, message: "Continuity note removed.", data: { noteId: note.id } };
    }

    case "delete_dailies_batch": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const batchId = payload.batchId ?? payload.taskId;
      if (!batchId) return { ok: false, error: "batchId required", status: 400 };
      const result = await prisma.dailiesBatch.deleteMany({
        where: { id: batchId, projectId: ctx.projectId },
      });
      if (result.count === 0) return { ok: false, error: "Dailies batch not found", status: 404 };
      return { ok: true, message: "Dailies batch removed.", data: { batchId } };
    }

    case "delete_project_idea": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const idea = payload.taskId
        ? await prisma.projectIdea.findFirst({ where: { id: payload.taskId, projectId: ctx.projectId } })
        : await prisma.projectIdea.findFirst({
            where: { projectId: ctx.projectId, title: payload.title?.trim() ?? "" },
          });
      if (!idea) return { ok: false, error: "Idea not found", status: 404 };
      await prisma.projectIdea.delete({ where: { id: idea.id } });
      return { ok: true, message: `Idea "${idea.title}" removed.`, data: { ideaId: idea.id } };
    }

    case "update_table_read_session": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const sessionId = payload.taskId ?? payload.eventId;
      if (!sessionId) return { ok: false, error: "session id required", status: 400 };
      const scheduled = parseVaActionDate(payload.date, payload.startAt);
      const result = await prisma.tableReadSession.updateMany({
        where: { id: sessionId, projectId: ctx.projectId },
        data: {
          ...(payload.title !== undefined ? { name: payload.title } : {}),
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(scheduled ? { scheduledAt: scheduled } : {}),
          ...(payload.notes !== undefined ? { notesLog: payload.notes } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Table read session not found", status: 404 };
      return { ok: true, message: "Table read session updated.", data: { sessionId } };
    }

    case "delete_table_read_session": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const sessionId = payload.taskId ?? payload.eventId;
      if (!sessionId) return { ok: false, error: "session id required", status: 400 };
      const result = await prisma.tableReadSession.deleteMany({
        where: { id: sessionId, projectId: ctx.projectId },
      });
      if (result.count === 0) return { ok: false, error: "Table read session not found", status: 404 };
      return { ok: true, message: "Table read session removed.", data: { sessionId } };
    }

    case "delete_music_selection": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const sel = payload.trackId
        ? await prisma.musicSelection.findFirst({ where: { projectId: ctx.projectId, trackId: payload.trackId } })
        : await prisma.musicSelection.findFirst({ where: { id: payload.taskId ?? "", projectId: ctx.projectId } });
      if (!sel) return { ok: false, error: "Music selection not found", status: 404 };
      await prisma.musicSelection.delete({ where: { id: sel.id } });
      return { ok: true, message: "Music selection removed.", data: { selectionId: sel.id } };
    }

    case "delete_footage_asset": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const asset = payload.taskId
        ? await prisma.footageAsset.findFirst({ where: { id: payload.taskId, projectId: ctx.projectId } })
        : null;
      if (!asset) return { ok: false, error: "Footage asset not found", status: 404 };
      await prisma.footageAsset.delete({ where: { id: asset.id } });
      return { ok: true, message: "Footage asset removed.", data: { assetId: asset.id } };
    }

    case "delete_risk_checklist_item": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const item = payload.taskId
        ? await prisma.riskChecklistItem.findFirst({ where: { id: payload.taskId } })
        : await prisma.riskChecklistItem.findFirst({
            where: {
              description: { contains: payload.title?.trim() ?? payload.description?.trim() ?? "", mode: "insensitive" },
              plan: { projectId: ctx.projectId },
            },
          });
      if (!item) return { ok: false, error: "Risk item not found", status: 404 };
      await prisma.riskChecklistItem.delete({ where: { id: item.id } });
      return { ok: true, message: "Risk checklist item removed.", data: { itemId: item.id } };
    }

    case "update_risk_checklist_item": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const itemId = payload.taskId;
      if (!itemId) return { ok: false, error: "item id required", status: 400 };
      const result = await prisma.riskChecklistItem.updateMany({
        where: { id: itemId, plan: { projectId: ctx.projectId } },
        data: {
          ...(payload.title !== undefined ? { description: payload.title } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
        },
      });
      if (result.count === 0) return { ok: false, error: "Risk item not found", status: 404 };
      return { ok: true, message: "Risk checklist item updated.", data: { itemId } };
    }

    case "create_visual_asset": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      if (!payload.category?.trim()) {
        return { ok: false, error: "category required", status: 400 };
      }
      if (!payload.fileUrl?.trim() && !payload.imageUrl?.trim()) {
        return { ok: false, error: "fileUrl or imageUrl required", status: 400 };
      }
      const agg = await prisma.projectVisualAsset.aggregate({
        where: { projectId: ctx.projectId, category: payload.category.trim() },
        _max: { sortOrder: true },
      });
      const asset = await prisma.projectVisualAsset.create({
        data: {
          projectId: ctx.projectId,
          category: payload.category.trim(),
          imageUrl: (payload.fileUrl ?? payload.imageUrl)!.trim(),
          title: payload.title?.trim() ?? payload.name?.trim() ?? null,
          caption: payload.description ?? payload.notes ?? null,
          sortOrder: (agg._max.sortOrder ?? -1) + 1,
        },
      });
      return { ok: true, message: `Visual asset "${asset.title}" added.`, data: { assetId: asset.id } };
    }

    case "delete_visual_asset": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const assetId = payload.taskId ?? payload.eventId;
      if (!assetId) return { ok: false, error: "assetId required", status: 400 };
      const result = await prisma.projectVisualAsset.deleteMany({
        where: { id: assetId, projectId: ctx.projectId },
      });
      if (result.count === 0) return { ok: false, error: "Visual asset not found", status: 404 };
      return { ok: true, message: "Visual asset removed.", data: { assetId } };
    }

    default:
      return null;
  }
}
