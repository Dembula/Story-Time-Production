import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { createCreatorCalendarEvent } from "@/lib/creator-command-center-calendar";
import { executeScriptBreakdown } from "@/lib/modoc/execute-breakdown";
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
      if (!payload.title?.trim() || !payload.startAt) {
        return { ok: false, error: "title and startAt are required", status: 400 };
      }
      const visibility = action === "create_team_calendar_event" ? "TEAM" : "PERSONAL";
      try {
        const created = await createCreatorCalendarEvent(userId, {
          title: payload.title.trim(),
          description: payload.description ?? null,
          startAt: payload.startAt,
          endAt: payload.endAt ?? null,
          allDay: true,
          visibility,
          projectId: payload.projectId ?? null,
          assigneeId: payload.assigneeId ?? null,
        });
        return {
          ok: true,
          message: `${visibility === "TEAM" ? "Team" : "Calendar"} event "${payload.title}" created.`,
          data: { eventId: created.id },
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create calendar event";
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
      if (!payload.projectId || !payload.title?.trim()) {
        return { ok: false, error: "projectId and title are required", status: 400 };
      }
      const access = await ensureProjectAccess(payload.projectId);
      if (access.error) {
        return { ok: false, error: "Project access denied", status: 403 };
      }
      const task = await prisma.projectTask.create({
        data: {
          projectId: payload.projectId,
          title: payload.title.trim(),
          description: payload.description ?? null,
          department: payload.department ?? null,
          priority: payload.priority ?? "MEDIUM",
          status: "TODO",
          createdById: userId,
        },
      });
      return {
        ok: true,
        message: `Task "${payload.title}" created.`,
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
      const extended = await executeExtendedModocAction(userId, action, payload);
      if (extended) return extended;
      const priority = await executePriorityModocAction(userId, action, payload);
      if (priority) return priority;
      return { ok: false, error: "Unknown action", status: 400 };
    }
  }
}
