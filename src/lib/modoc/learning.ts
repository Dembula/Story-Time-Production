import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/lib/prisma-json";
import { appendActionLog, migrateJsonLearningToDb } from "./learning-store";

export type ModocPlaybookEntry = {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** WHEN condition — self-authored trigger */
  when: string;
  /** THEN behavior — self-authored instruction the VA follows */
  then: string;
  origin: "pattern_detected" | "action_success" | "explicit";
  hits: number;
  confidence: number;
};

export type ModocRecentAction = {
  at: string;
  action: string;
  payload?: Record<string, unknown>;
  ok?: boolean;
  message?: string;
  eventId?: string;
  taskIds?: string[];
  conversationId?: string;
};

export type ModocLearningProfile = {
  lastGreetingAt?: string;
  acceptedActions?: Record<string, number>;
  declinedActions?: Record<string, number>;
  lastEvaluatedAt?: string;
  preferredSuggestions?: string[];
  /** Rolling log of VA-executed actions so follow-up chat can redo or adapt. */
  recentActions?: ModocRecentAction[];
  /** Self-evolving behavior rules (auto-learned playbook). */
  playbook?: ModocPlaybookEntry[];
  /** Topic frequency from chat messages */
  topicCounts?: Record<string, number>;
  /** Total chat turns ingested for learning */
  interactionCount?: number;
  lastLearnedAt?: string;
};

function parseExtras(raw: unknown): ModocLearningProfile {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const modoc = obj.modoc;
  if (!modoc || typeof modoc !== "object") return {};
  return modoc as ModocLearningProfile;
}

export async function getModocLearning(userId: string): Promise<ModocLearningProfile> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { profileExtras: true },
  });
  return parseExtras(pref?.profileExtras);
}

export async function saveModocLearning(
  userId: string,
  patch: Partial<ModocLearningProfile>,
): Promise<ModocLearningProfile> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { profileExtras: true },
  });
  const extras =
    pref?.profileExtras && typeof pref.profileExtras === "object"
      ? (pref.profileExtras as Record<string, unknown>)
      : {};
  const current = parseExtras(extras);
  const next: ModocLearningProfile = { ...current, ...patch };

  const merged = { ...extras, modoc: next };
  await prisma.userPreference.upsert({
    where: { userId },
    update: { profileExtras: merged as InputJsonValue },
    create: { userId, profileExtras: merged as InputJsonValue },
  });
  return next;
}

export async function recordModocActionFeedback(
  userId: string,
  action: string,
  accepted: boolean,
): Promise<void> {
  const current = await getModocLearning(userId);
  const key = accepted ? "acceptedActions" : "declinedActions";
  const bucket = { ...(current[key] ?? {}) };
  bucket[action] = (bucket[action] ?? 0) + 1;

  const preferred = new Set(current.preferredSuggestions ?? []);
  if (accepted) preferred.add(action);
  else if ((bucket[action] ?? 0) > 2) preferred.delete(action);

  const preferredSuggestions = Array.from(preferred).slice(-100);

  await saveModocLearning(userId, {
    [key]: bucket,
    preferredSuggestions,
  });
}

export async function recordModocActionExecution(
  userId: string,
  entry: ModocRecentAction,
): Promise<void> {
  const current = await getModocLearning(userId);
  await migrateJsonLearningToDb(userId, current);
  await appendActionLog(userId, entry);
}

export function learningHint(profile: ModocLearningProfile): string | null {
  const accepted = profile.acceptedActions ?? {};
  const top = Object.entries(accepted).sort((a, b) => b[1] - a[1])[0];
  const interactions = profile.interactionCount ?? 0;

  if (!top) {
    if (interactions > 0) {
      return `Auto-learning active — ${interactions.toLocaleString()} conversation${interactions === 1 ? "" : "s"} analyzed. I keep improving from every message.`;
    }
    return null;
  }
  const labels: Record<string, string> = {
    breakdown_full: "script breakdowns",
    create_project_task: "creating tasks",
    create_calendar_event: "scheduling calendar events",
    create_team_calendar_event: "team calendar events",
    delete_calendar_event: "removing calendar tasks",
    delete_project_task: "deleting tasks",
    move_to_production: "moving projects to production",
  };
  const label = labels[top[0]] ?? top[0].replace(/_/g, " ");
  const base = `I've noticed you often want help with ${label} — I'll keep suggesting those when relevant.`;
  if (interactions > 0) {
    return `${base} Auto-learning from ${interactions.toLocaleString()} chats.`;
  }
  return base;
}
