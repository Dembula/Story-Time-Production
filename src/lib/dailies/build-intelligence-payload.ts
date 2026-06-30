import { prisma } from "@/lib/prisma";
import {
  analyzeFootageClip,
  generateProductionInsights,
} from "@/lib/dailies/ai-footage-analysis";
import type {
  AiFootageInsight,
  ClipProductionMetadata,
  DailiesClipRecord,
  DailiesIntelligencePayload,
  DailiesNoteRecord,
  DailiesShootDaySummary,
  DailiesTakeFlag,
  DailiesTakeStatus,
} from "@/lib/dailies/types";

function parseFlags(raw: unknown): DailiesTakeFlag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is DailiesTakeFlag => typeof f === "string");
}

function parseMeta(raw: unknown): ClipProductionMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ClipProductionMetadata;
}

function parseAi(raw: unknown): AiFootageInsight[] | null {
  if (!Array.isArray(raw)) return null;
  return raw as AiFootageInsight[];
}

export async function buildDailiesIntelligence(projectId: string): Promise<DailiesIntelligencePayload> {
  const [clipsRaw, batches, scenes, shootDays, continuityNotes, visualAssets, script] = await Promise.all([
    prisma.dailiesClip.findMany({
      where: { projectId },
      include: {
        scene: { select: { number: true, heading: true } },
        shootDay: { select: { id: true, date: true, unit: true, status: true } },
        notes: {
          where: { parentNoteId: null },
          include: { user: { select: { name: true, email: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }, { sortOrder: "asc" }],
    }),
    prisma.dailiesBatch.findMany({
      where: { projectId, videoUrl: { not: null } },
      select: { id: true },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      select: { id: true, number: true, heading: true },
      orderBy: { number: "asc" },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      include: { scenes: { select: { sceneId: true } } },
    }),
    prisma.continuityNote.findMany({
      where: { projectId },
      select: { sceneId: true, shootDayId: true },
    }),
    prisma.projectVisualAsset.count({ where: { projectId, category: "scene" } }),
    prisma.projectScript.findFirst({
      where: { projectId },
      select: { id: true },
    }),
  ]);

  const continuityByScene = new Map<string, number>();
  for (const n of continuityNotes) {
    if (!n.sceneId) continue;
    continuityByScene.set(n.sceneId, (continuityByScene.get(n.sceneId) ?? 0) + 1);
  }

  const clips: DailiesClipRecord[] = clipsRaw.map((c) => {
    const noteList = c.notes.map((n) => ({
      body: n.body,
      category: n.category,
      priority: n.priority,
    }));
    const aiFromDb = parseAi(c.aiAnalysis);
    const aiComputed =
      aiFromDb ??
      analyzeFootageClip({
        clip: {
          title: c.title,
          takeStatus: c.takeStatus,
          takeFlags: c.takeFlags,
          metadata: c.metadata,
          durationMs: c.durationMs,
          notes: noteList,
        },
        sceneHeading: c.scene?.heading ?? null,
        continuityNoteCount: c.sceneId ? (continuityByScene.get(c.sceneId) ?? 0) : 0,
      });

    return {
      id: c.id,
      batchId: c.batchId,
      sceneId: c.sceneId,
      sceneNumber: c.scene?.number ?? null,
      sceneHeading: c.scene?.heading ?? null,
      shootDayId: c.shootDayId,
      shootDayDate: c.shootDay?.date.toISOString() ?? null,
      unit: c.unit ?? c.shootDay?.unit ?? null,
      title: c.title,
      videoUrl: c.videoUrl,
      proxyUrl: c.proxyUrl,
      streamStatus: c.streamStatus,
      shotNumber: c.shotNumber,
      takeNumber: c.takeNumber,
      camera: c.camera,
      lens: c.lens,
      slate: c.slate,
      location: c.location,
      sequence: c.sequence,
      editorBin: c.editorBin,
      durationMs: c.durationMs,
      fileSizeBytes: c.fileSizeBytes != null ? Number(c.fileSizeBytes) : null,
      metadata: parseMeta(c.metadata),
      takeStatus: c.takeStatus as DailiesTakeStatus,
      takeFlags: parseFlags(c.takeFlags),
      aiAnalysis: aiComputed,
      noteCount: c.notes.length,
      openNoteCount: c.notes.filter((n) => !n.resolved).length,
      createdAt: c.createdAt.toISOString(),
    };
  });

  const allNotes: DailiesNoteRecord[] = clipsRaw.flatMap((c) =>
    c.notes.map((n) => ({
      id: n.id,
      clipId: n.clipId,
      batchId: n.batchId,
      body: n.body,
      timestampMs: n.timestampMs,
      frameNumber: n.frameNumber,
      department: n.department,
      priority: n.priority as DailiesNoteRecord["priority"],
      status: n.status,
      category: n.category as DailiesNoteRecord["category"],
      resolved: n.resolved,
      drawings: n.drawings,
      createdAt: n.createdAt.toISOString(),
      reviewerName: n.user?.name ?? n.user?.email ?? null,
    })),
  );

  const shootDaySummaries: DailiesShootDaySummary[] = shootDays.map((day) => {
    const dayClips = clips.filter((c) => c.shootDayId === day.id);
    const sceneIds = new Set(dayClips.map((c) => c.sceneId).filter(Boolean));
    const dayNotes = allNotes.filter((n) => {
      const clip = dayClips.find((c) => c.id === n.clipId);
      return !!clip;
    });
    const reviewed = dayClips.filter((c) => c.takeStatus !== "pending").length;
    const completion = dayClips.length > 0 ? Math.round((reviewed / dayClips.length) * 100) : 0;
    return {
      shootDayId: day.id,
      date: day.date.toISOString(),
      unit: day.unit,
      status: day.status,
      clipCount: dayClips.length,
      takeCount: dayClips.length,
      scenesCompleted: sceneIds.size,
      pendingReviews: dayClips.filter((c) => c.takeStatus === "pending").length,
      approvedTakes: dayClips.filter((c) => c.takeStatus === "approved").length,
      circleTakes: dayClips.filter((c) => c.takeStatus === "circle").length,
      rejectedTakes: dayClips.filter((c) => c.takeStatus === "rejected").length,
      reviewCompletionPercent: completion,
      openNotes: dayNotes.filter((n) => !n.resolved).length,
      criticalIssues: dayNotes.filter((n) => n.priority === "critical" && !n.resolved).length,
    };
  });

  const activeShootDay = shootDaySummaries.find((d) => d.clipCount > 0) ?? shootDaySummaries[0] ?? null;

  const scenesWithFootage = new Set(clips.map((c) => c.sceneId).filter(Boolean));
  const pendingReviews = clips.filter((c) => c.takeStatus === "pending").length;
  const approvedTakes = clips.filter((c) => c.takeStatus === "approved").length;
  const circleTakes = clips.filter((c) => c.takeStatus === "circle").length;
  const rejectedTakes = clips.filter((c) => c.takeStatus === "rejected").length;
  const footageUploaded = clips.filter((c) => c.videoUrl).length;
  const footageProcessing = clips.filter((c) => c.streamStatus === "processing").length;
  const proxyReady = clips.filter((c) => c.proxyUrl || c.streamStatus === "ready").length;
  const openNotes = allNotes.filter((n) => !n.resolved).length;
  const criticalIssues = allNotes.filter((n) => n.priority === "critical" && !n.resolved).length;
  const reviewed = clips.filter((c) => c.takeStatus !== "pending").length;
  const reviewCompletionPercent = clips.length > 0 ? Math.round((reviewed / clips.length) * 100) : 0;
  const coveragePercent = scenes.length > 0 ? Math.round((scenesWithFootage.size / scenes.length) * 100) : 0;

  const aiScores = clips.flatMap((c) => c.aiAnalysis ?? []).filter((i) => i.severity !== "info");
  const aiQualityScore =
    clips.length > 0 ? Math.max(0, Math.min(100, 100 - aiScores.length * 8 - criticalIssues * 10)) : 0;
  const productionHealthScore = Math.round(
    (reviewCompletionPercent * 0.35 +
      coveragePercent * 0.35 +
      aiQualityScore * 0.2 +
      (criticalIssues === 0 ? 20 : Math.max(0, 20 - criticalIssues * 5))) /
      1.1,
  );

  const basePath = `/creator/projects/${projectId}`;
  const insights = generateProductionInsights(clips, scenes.length, allNotes);

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    activeShootDay,
    summary: {
      totalClips: clips.length,
      totalTakes: clips.length,
      completedScenes: scenesWithFootage.size,
      pendingReviews,
      approvedTakes,
      circleTakes,
      rejectedTakes,
      footageUploaded,
      footageProcessing,
      proxyReady,
      openNotes,
      criticalIssues,
      reviewCompletionPercent,
      productionHealthScore,
      coveragePercent,
      aiQualityScore,
    },
    clips,
    shootDays: shootDaySummaries,
    insights,
    scriptSceneCount: scenes.length,
    storyboardCount: visualAssets,
    linkedTools: [
      {
        label: "Shoot Progress",
        href: `${basePath}/production/shoot-progress`,
        description: "Day status and pages completed on set",
        status: shootDays.length > 0 ? "ready" : "empty",
      },
      {
        label: "Continuity Manager",
        href: `${basePath}/production/continuity-manager`,
        description: "Take notes, photos, and continuity flags",
        status: continuityNotes.length > 0 ? "ready" : clips.length > 0 ? "partial" : "empty",
      },
      {
        label: "Script Breakdown",
        href: `${basePath}/pre-production/script-breakdown`,
        description: "Scene coverage and department tags",
        status: scenes.length > 0 ? "ready" : "empty",
      },
      {
        label: "Visual Planning",
        href: `${basePath}/pre-production/visual-planning`,
        description: "Storyboards and shot references",
        status: visualAssets > 0 ? "ready" : "partial",
      },
      {
        label: "Production Scheduling",
        href: `${basePath}/pre-production/production-scheduling`,
        description: "Stripboard and shoot days",
        status: shootDays.length > 0 ? "ready" : "empty",
      },
      {
        label: "Footage Ingestion",
        href: `${basePath}/post-production/footage-ingestion`,
        description: "Editorial handoff and proxy workflow",
        status: circleTakes > 0 ? "partial" : "empty",
      },
      {
        label: "Call Sheets",
        href: `${basePath}/production/call-sheet-generator`,
        description: "Daily call sheets linked to shoot days",
        status: shootDays.length > 0 ? "partial" : "empty",
      },
    ],
  };
}

export async function ensureLegacyClipsFromBatches(projectId: string): Promise<void> {
  const batches = await prisma.dailiesBatch.findMany({
    where: { projectId, videoUrl: { not: null } },
    include: { clips: { select: { id: true }, take: 1 } },
  });
  for (const b of batches) {
    if (b.clips.length > 0) continue;
    await prisma.dailiesClip.create({
      data: {
        id: `legacy_${b.id}`,
        projectId: b.projectId,
        batchId: b.id,
        sceneId: b.sceneId,
        shootDayId: b.shootDayId,
        title: b.title ?? "Legacy batch clip",
        videoUrl: b.videoUrl,
        streamStatus: "ready",
        takeStatus: "pending",
      },
    });
  }
}
