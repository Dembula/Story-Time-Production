import { prisma } from "@/lib/prisma";
import { buildPlaybookPromptForUser } from "./auto-learn";
import { CALENDAR_LOOKBACK_DAYS, MAX_ACTION_LOG_IN_PROMPT } from "./learning-limits";
import { getModocLearning, type ModocLearningProfile, type ModocRecentAction } from "./learning";
import { getRecentActionLogs } from "./learning-store";

export async function buildVaAwarenessContext(userId: string): Promise<string> {
  const lookbackMs = CALENDAR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  const [learning, events, recentActions, playbookPrompt] = await Promise.all([
    getModocLearning(userId).catch(
      (): ModocLearningProfile => ({ preferredSuggestions: [] }),
    ),
    prisma.creatorCalendarEvent.findMany({
      where: {
        ownerUserId: userId,
        startAt: { gte: new Date(Date.now() - lookbackMs) },
      },
      orderBy: { startAt: "asc" },
      take: 150,
      select: { id: true, title: true, startAt: true, visibility: true, description: true },
    }),
    getRecentActionLogs(userId, MAX_ACTION_LOG_IN_PROMPT).catch(
      (): ModocRecentAction[] => [],
    ),
    buildPlaybookPromptForUser(userId).catch(() => ""),
  ]);

  const lines: string[] = [];

  if (recentActions.length > 0) {
    lines.push("**Recent actions you (the VA) performed for this creator:**");
    for (const action of recentActions) {
      const title =
        typeof action.payload?.title === "string" ? action.payload.title : null;
      const projectId =
        typeof action.payload?.projectId === "string" ? action.payload.projectId : null;
      const status = action.ok === false ? "failed" : "completed";
      lines.push(
        `- ${action.at} | ${action.action} | status=${status}${title ? ` | title="${title}"` : ""}${projectId ? ` | projectId=${projectId}` : ""}${action.eventId ? ` | eventId=${action.eventId}` : ""}${action.message ? ` | result="${action.message.slice(0, 120)}"` : ""}`,
      );
    }
  }

  if (events.length > 0) {
    lines.push("\n**Command Center calendar (database):**");
    for (const event of events) {
      lines.push(
        `- id=${event.id} | "${event.title}" | ${event.startAt.toISOString()} | ${event.visibility}`,
      );
    }
  } else {
    lines.push("\n**Command Center calendar:** no events in the recent window.");
  }

  const missing = findMissingVaCalendarEvents(recentActions, events);
  if (missing.length > 0) {
    lines.push(
      `\n**Deleted or missing VA-created events:** ${missing.map((t) => `"${t}"`).join(", ")}`,
    );
  }

  const prefs = learning.preferredSuggestions ?? [];
  if (prefs.length > 0) {
    lines.push(`\n**Creator preferences learned:** often accepts ${prefs.join(", ")}.`);
  }

  lines.push("", playbookPrompt);

  return lines.join("\n");
}

function findMissingVaCalendarEvents(
  recentActions: ModocRecentAction[],
  events: Array<{ id: string; title: string }>,
): string[] {
  const titles = new Set(events.map((e) => e.title.toLowerCase()));
  const ids = new Set(events.map((e) => e.id));
  const missing: string[] = [];

  for (const action of recentActions) {
    if (
      action.action !== "create_calendar_event" &&
      action.action !== "create_team_calendar_event"
    ) {
      continue;
    }
    if (action.ok === false) continue;
    const title = typeof action.payload?.title === "string" ? action.payload.title : null;
    const eventId = action.eventId;
    const stillExists =
      (eventId && ids.has(eventId)) || (title && titles.has(title.toLowerCase()));
    if (!stillExists && title && !missing.includes(title)) {
      missing.push(title);
    }
  }

  return missing;
}
