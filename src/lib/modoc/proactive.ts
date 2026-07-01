import { prisma } from "@/lib/prisma";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";
import { notifyUser } from "@/lib/notify-user";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function suggestScriptBreakdownAfterSave(params: {
  userId: string;
  projectId: string;
  scriptTitle: string;
  versionLabel?: string | null;
  versionCount: number;
  isNewVersion: boolean;
}): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return;

  const recent = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      type: "VA_SUGGESTION",
      read: false,
      createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    try {
      const meta = JSON.parse(recent.metadata ?? "{}") as { projectId?: string; action?: string };
      if (meta.projectId === params.projectId && meta.action === "breakdown_full") return;
    } catch {
      // continue
    }
  }

  const [charCount, sceneCount] = await Promise.all([
    prisma.breakdownCharacter.count({ where: { projectId: params.projectId } }),
    prisma.projectScene.count({ where: { projectId: params.projectId } }),
  ]);

  const needsBreakdown = charCount === 0;
  const needsSceneSync = sceneCount === 0;

  if (!params.isNewVersion && !needsBreakdown) return;

  const project = await prisma.originalProject.findUnique({
    where: { id: params.projectId },
    select: { title: true },
  });

  const scriptName = params.scriptTitle || project?.title || "your screenplay";
  const draftLabel =
    params.versionLabel?.trim() ||
    (params.versionCount > 1 ? `Draft ${params.versionCount}` : "latest draft");

  let body: string;
  let action: string;
  if (needsSceneSync) {
    action = "sync_scenes_from_script";
    body = `I noticed "${scriptName}" (${draftLabel}) was just saved. Would you like me to sync scenes from the screenplay first, then run a full breakdown?`;
  } else {
    action = "breakdown_full";
    body = `Would you like me to run a full script breakdown on "${scriptName}" (${draftLabel})? I'll extract characters, props, locations, wardrobe, and more.`;
  }

  await notifyUser({
    userId: params.userId,
    type: "VA_SUGGESTION",
    title: "MODOC suggestion",
    body,
    metadata: {
      action,
      projectId: params.projectId,
      scriptTitle: scriptName,
      versionLabel: draftLabel,
      followUpAction: needsSceneSync ? "breakdown_full" : undefined,
      url: `/creator/projects/${params.projectId}/pre-production/script-breakdown`,
    },
  });
}

export async function suggestProductionReadiness(params: {
  userId: string;
  projectId: string;
}): Promise<void> {
  const project = await prisma.originalProject.findUnique({
    where: { id: params.projectId },
    select: { title: true, status: true, phase: true },
  });
  if (!project || project.status === "IN_PRODUCTION") return;

  const [charCount, budget, scheduleDays] = await Promise.all([
    prisma.breakdownCharacter.count({ where: { projectId: params.projectId } }),
    resolveDefaultProjectBudget(params.projectId),
    prisma.shootDay.count({ where: { projectId: params.projectId } }),
  ]);
  const budgetCount = budget?.lines.length ?? 0;

  if (charCount < 1 || budgetCount < 1 || scheduleDays < 1) return;

  const recent = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      type: "VA_SUGGESTION",
      read: false,
      createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) },
    },
  });
  if (recent) return;

  await notifyUser({
    userId: params.userId,
    type: "VA_SUGGESTION",
    title: "Ready for production?",
    body: `"${project.title}" has a breakdown, budget, and schedule. Would you like me to move it to production and create starter on-set tasks?`,
    metadata: {
      action: "move_to_production",
      projectId: params.projectId,
      url: `/creator/projects/${params.projectId}/overview`,
    },
  });
}
