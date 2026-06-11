import { prisma } from "@/lib/prisma";

export type ModocLearningProfile = {
  lastGreetingAt?: string;
  acceptedActions?: Record<string, number>;
  declinedActions?: Record<string, number>;
  lastEvaluatedAt?: string;
  preferredSuggestions?: string[];
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
    update: { profileExtras: merged },
    create: { userId, profileExtras: merged },
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

  await saveModocLearning(userId, {
    [key]: bucket,
    preferredSuggestions: Array.from(preferred),
  });
}

export function learningHint(profile: ModocLearningProfile): string | null {
  const accepted = profile.acceptedActions ?? {};
  const top = Object.entries(accepted).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const labels: Record<string, string> = {
    breakdown_full: "script breakdowns",
    create_project_task: "creating tasks",
    create_calendar_event: "scheduling calendar events",
    create_team_calendar_event: "team calendar events",
    move_to_production: "moving projects to production",
  };
  const label = labels[top[0]] ?? top[0].replace(/_/g, " ");
  return `I've noticed you often want help with ${label} — I'll keep suggesting those when relevant.`;
}
