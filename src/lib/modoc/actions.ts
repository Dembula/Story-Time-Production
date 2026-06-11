import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { createCreatorCalendarEvent, deleteCreatorCalendarEvent, updateCreatorCalendarEvent } from "@/lib/creator-command-center-calendar";
import { executeScriptBreakdown } from "@/lib/modoc/execute-breakdown";
import {
  normalizeCalendarStartAt,
  parseVaActionDate,
  resolveVaProjectId,
} from "@/lib/modoc/va-scheduling";
import {
  vaAddBudgetLine,
  vaCreateBudget,
  vaCreateCastingRole,
  vaCreateCrewNeed,
  vaCreateProductionExpense,
  vaCreateShootDay,
  vaGenerateBudgetFromBreakdown,
  vaSyncCastingFromBreakdown,
  vaUpdateIdeaNotes,
} from "@/lib/modoc/execute-va-project-tools";
import { executeExtendedModocAction } from "@/lib/modoc/execute-va-extended-actions";
import { executeVaCrudAction } from "@/lib/modoc/execute-va-crud";
import { executePriorityModocAction } from "@/lib/modoc/execute-va-priority-actions";
import type { ModocActionPayload, ModocActionType } from "@/lib/modoc/action-types";

export type { ModocActionPayload, ModocActionType } from "@/lib/modoc/action-types";
export type ModocActionResult =
  | { ok: true; message: string; data?: Record<string, unknown> }
  | { ok: false; error: string; status: number };

export async function executeModocAction(
  userId: string,
  action: ModocActionType,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  switch (action) {
    case "breakdown_full":
    case "breakdown_scenes": {
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      const access = await ensureProjectAccess(payload.projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }
      const mode = action === "breakdown_scenes" ? "scenes" : "full";
      const result = await executeScriptBreakdown(payload.projectId, mode);
      if (!result.ok) {
        return { ok: false, error: result.error, status: result.status ?? 500 };
      }
      const warn =
        result.warnings.length > 0
          ? ` Warnings: ${result.warnings.slice(0, 3).join("; ")}`
          : "";
      return {
        ok: true,
        message: `Script breakdown (${mode}) completed successfully.${warn}`,
        data: { warnings: result.warnings },
      };
    }

    case "sync_scenes_from_script": {
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      const access = await ensureProjectAccess(payload.projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }
      const script = await prisma.projectScript.findFirst({
        where: { projectId: payload.projectId },
        include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!script) {
        return { ok: false, error: "No screenplay found for this project.", status: 400 };
      }
      let content = "";
      if (script.currentVersionId) {
        const v = await prisma.projectScriptVersion.findUnique({
          where: { id: script.currentVersionId },
        });
        content = v?.content ?? "";
      }
      if (!content && script.versions[0]) content = script.versions[0].content ?? "";
      if (!content.trim()) {
        return { ok: false, error: "Screenplay has no content to sync from.", status: 400 };
      }

      const slugRegex = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+.+/gim;
      const matches = [...content.matchAll(slugRegex)];
      let created = 0;
      for (let i = 0; i < matches.length; i++) {
        const heading = matches[i][0].trim();
        const number = String(i + 1);
        const existing = await prisma.projectScene.findFirst({
          where: { projectId: payload.projectId, number },
        });
        if (!existing) {
          await prisma.projectScene.create({
            data: {
              projectId: payload.projectId,
              scriptId: script.id,
              number,
              heading,
            },
          });
          created++;
        }
      }
      return {
        ok: true,
        message: `Synced ${created} new scene(s) from screenplay slug lines.`,
        data: { created },
      };
    }

    case "create_calendar_event":
    case "create_team_calendar_event": {
      if (!payload.title?.trim()) {
        return { ok: false, error: "title is required", status: 400 };
      }
      const startRaw = payload.startAt ?? payload.date ?? payload.dueDate;
      if (!startRaw) {
        return { ok: false, error: "startAt or date is required (ISO or YYYY-MM-DD)", status: 400 };
      }
      let startAt: string;
      try {
        startAt = normalizeCalendarStartAt(startRaw).toISOString();
      } catch {
        return { ok: false, error: "Invalid start date", status: 400 };
      }
      const visibility = action === "create_team_calendar_event" ? "TEAM" : "PERSONAL";
      const projectId =
        payload.projectId ?? (await resolveVaProjectId(userId, null)) ?? undefined;
      try {
        const created = await createCreatorCalendarEvent(userId, {
          title: payload.title.trim(),
          description: payload.description ?? null,
          startAt,
          endAt: payload.endAt ?? null,
          allDay: true,
          visibility,
          projectId: projectId ?? null,
          assigneeId: payload.assigneeId ?? null,
        });
        return {
          ok: true,
          message: `${visibility === "TEAM" ? "Team" : "Calendar"} task "${payload.title}" scheduled for ${new Date(startAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.`,
          data: { eventId: created.id, startAt },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create calendar event";
        return { ok: false, error: msg, status: 400 };
      }
    }

    case "update_calendar_event": {
      if (!payload.eventId) {
        return { ok: false, error: "eventId is required", status: 400 };
      }
      try {
        const startRaw = payload.startAt ?? payload.date ?? payload.dueDate;
        await updateCreatorCalendarEvent(userId, payload.eventId, {
          ...(payload.title != null ? { title: payload.title } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(startRaw ? { startAt: normalizeCalendarStartAt(startRaw).toISOString() } : {}),
          ...(payload.endAt !== undefined ? { endAt: payload.endAt } : {}),
          ...(payload.projectId !== undefined ? { projectId: payload.projectId } : {}),
          ...(payload.assigneeId !== undefined ? { assigneeId: payload.assigneeId } : {}),
        });
        return { ok: true, message: "Calendar task updated.", data: { eventId: payload.eventId } };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to update calendar event";
        return { ok: false, error: msg, status: 400 };
      }
    }

    case "delete_calendar_event": {
      try {
        if (payload.eventId) {
          await deleteCreatorCalendarEvent(userId, payload.eventId);
          return { ok: true, message: "Calendar task removed.", data: { eventId: payload.eventId } };
        }
        if (!payload.title?.trim()) {
          return { ok: false, error: "eventId or title is required", status: 400 };
        }
        const start = parseVaActionDate(payload.startAt, payload.date, payload.dueDate);
        const matches = await prisma.creatorCalendarEvent.findMany({
          where: {
            OR: [{ ownerUserId: userId }, { createdById: userId }],
            title: { equals: payload.title.trim(), mode: "insensitive" },
            ...(start
              ? {
                  startAt: {
                    gte: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
                    lt: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1),
                  },
                }
              : {}),
          },
          select: { id: true, title: true },
          take: 5,
        });
        if (matches.length === 0) {
          return { ok: false, error: "Calendar task not found", status: 404 };
        }
        if (matches.length > 1 && !start) {
          return {
            ok: false,
            error: "Multiple calendar tasks match — provide eventId or a date",
            status: 400,
          };
        }
        await deleteCreatorCalendarEvent(userId, matches[0].id);
        return {
          ok: true,
          message: `Calendar task "${matches[0].title}" removed.`,
          data: { eventId: matches[0].id },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to delete calendar event";
        return { ok: false, error: msg, status: 400 };
      }
    }

    case "create_starter_tasks": {
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      const access = await ensureProjectAccess(payload.projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }
      const starters = [
        { title: "Review call sheet & schedule", department: "Production", priority: "HIGH" },
        { title: "Equipment check & sign-out", department: "Camera", priority: "MEDIUM" },
        { title: "Safety brief & risk checklist", department: "Safety", priority: "HIGH" },
      ];
      const ids: string[] = [];
      for (const s of starters) {
        const task = await prisma.projectTask.create({
          data: {
            projectId: payload.projectId,
            title: s.title,
            department: s.department,
            priority: s.priority,
            status: "TODO",
            createdById: userId,
          },
        });
        ids.push(task.id);
      }
      return {
        ok: true,
        message: `Created ${ids.length} starter on-set tasks.`,
        data: { taskIds: ids },
      };
    }

    case "create_project_task": {
      if (!payload.title?.trim()) {
        return { ok: false, error: "title is required", status: 400 };
      }
      const dueDate = parseVaActionDate(payload.dueDate, payload.date, payload.startAt);
      const projectId = await resolveVaProjectId(userId, payload.projectId);

      // Dated task without a project → Command Center calendar (what creators expect on the calendar UI)
      if (!projectId && dueDate) {
        try {
          const created = await createCreatorCalendarEvent(userId, {
            title: payload.title.trim(),
            description: payload.description ?? null,
            startAt: dueDate.toISOString(),
            allDay: true,
            visibility: "PERSONAL",
          });
          return {
            ok: true,
            message: `Calendar task "${payload.title}" scheduled for ${dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}.`,
            data: { eventId: created.id, startAt: dueDate.toISOString() },
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to create calendar task";
          return { ok: false, error: msg, status: 400 };
        }
      }

      if (!projectId) {
        return {
          ok: false,
          error: "No project found — use create_calendar_event with title + date for Command Center tasks",
          status: 400,
        };
      }

      const access = await ensureProjectAccess(projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }

      const task = await prisma.projectTask.create({
        data: {
          projectId,
          title: payload.title.trim(),
          description: payload.description ?? null,
          department: payload.department ?? null,
          priority: payload.priority ?? "MEDIUM",
          status: "TODO",
          dueDate: dueDate ?? null,
          createdById: userId,
        },
      });

      const dateNote = dueDate
        ? ` due ${dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
        : "";

      return {
        ok: true,
        message: `Task "${payload.title}" created${dateNote}.`,
        data: { taskId: task.id, dueDate: dueDate?.toISOString() ?? null },
      };
    }

    case "update_project_task": {
      const projectId = await resolveVaProjectId(userId, payload.projectId);
      if (!projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      const access = await ensureProjectAccess(projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }
      if (!payload.taskId && !payload.title) {
        return { ok: false, error: "taskId or title required", status: 400 };
      }
      const task = payload.taskId
        ? await prisma.projectTask.findFirst({ where: { id: payload.taskId, projectId } })
        : await prisma.projectTask.findFirst({ where: { projectId, title: payload.title!.trim() } });
      if (!task) return { ok: false, error: "Task not found", status: 404 };

      const dueDate = parseVaActionDate(payload.dueDate, payload.date, payload.startAt);
      await prisma.projectTask.update({
        where: { id: task.id },
        data: {
          ...(payload.title != null ? { title: payload.title.trim() } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.department !== undefined ? { department: payload.department } : {}),
          ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
          ...(payload.status !== undefined ? { status: payload.status } : {}),
          ...(dueDate != null ? { dueDate } : {}),
        },
      });
      return {
        ok: true,
        message: `Task "${task.title}" updated.`,
        data: { taskId: task.id },
      };
    }

    case "delete_project_task": {
      const projectId = await resolveVaProjectId(userId, payload.projectId);
      if (!projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      const access = await ensureProjectAccess(projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }
      if (!payload.taskId && !payload.title) {
        return { ok: false, error: "taskId or title required", status: 400 };
      }
      const task = payload.taskId
        ? await prisma.projectTask.findFirst({ where: { id: payload.taskId, projectId } })
        : await prisma.projectTask.findFirst({ where: { projectId, title: payload.title!.trim() } });
      if (!task) return { ok: false, error: "Task not found", status: 404 };
      await prisma.projectTask.delete({ where: { id: task.id } });
      return {
        ok: true,
        message: `Task "${task.title}" deleted.`,
        data: { taskId: task.id },
      };
    }

    case "move_to_production": {
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      const access = await ensureProjectAccess(payload.projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }
      const project = await prisma.originalProject.update({
        where: { id: payload.projectId },
        data: { status: "IN_PRODUCTION", phase: "PRODUCTION" },
        select: { id: true, title: true, status: true, phase: true },
      });
      return {
        ok: true,
        message: `Project "${project.title}" moved to production.`,
        data: { projectId: project.id, status: project.status, phase: project.phase },
      };
    }

    case "create_budget":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaCreateBudget(payload.projectId, payload);

    case "generate_budget_from_breakdown":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaGenerateBudgetFromBreakdown(payload.projectId, payload);

    case "add_budget_line":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaAddBudgetLine(payload.projectId, payload);

    case "create_shoot_day":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaCreateShootDay(payload.projectId, payload);

    case "sync_casting_from_breakdown":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaSyncCastingFromBreakdown(payload.projectId);

    case "create_casting_role":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaCreateCastingRole(payload.projectId, payload);

    case "create_crew_need":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaCreateCrewNeed(payload.projectId, payload);

    case "create_production_expense":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaCreateProductionExpense(userId, payload.projectId, payload);

    case "update_idea_notes":
      if (!payload.projectId) {
        return { ok: false, error: "projectId is required", status: 400 };
      }
      return vaUpdateIdeaNotes(payload.projectId, payload);

    default: {
      const crud = await executeVaCrudAction(userId, action, payload);
      if (crud) return crud;
      const extended = await executeExtendedModocAction(userId, action, payload);
      if (extended) return extended;
      const priority = await executePriorityModocAction(userId, action, payload);
      if (priority) return priority;
      return { ok: false, error: "Unknown action", status: 400 };
    }
  }
}
