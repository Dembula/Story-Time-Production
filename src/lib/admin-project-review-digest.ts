import { prisma } from "@/lib/prisma";
import { ALL_PROJECT_TOOLS } from "@/lib/project-tools";
import { getStoryTimeOriginalBadge, isStoryTimeOriginalGreenlit } from "@/lib/storytime-original";
import { parsePlatformScriptVersionId } from "@/lib/content-catalogue-tags";
import {
  buildPipelineRollup,
  resolveToolProgressForProject,
} from "@/lib/project-tool-progress";
import { loadProjectUsageSignals } from "@/lib/project-usage-signals";

function toolLabel(toolId: string): string {
  return ALL_PROJECT_TOOLS.find((t) => t.id === toolId)?.label ?? toolId;
}

const CREATOR_SELECT = {
  id: true,
  name: true,
  email: true,
  networkHandle: true,
  image: true,
  bio: true,
  headline: true,
  location: true,
  website: true,
  role: true,
  professionalName: true,
  primaryRole: true,
  createdAt: true,
} as const;

export async function buildAdminProjectReviewDigest(projectId: string) {
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      pitches: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { creator: { select: CREATOR_SELECT } },
      },
      members: {
        include: { user: { select: { ...CREATOR_SELECT, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      toolProgress: { orderBy: { updatedAt: "desc" } },
      scripts: {
        orderBy: { updatedAt: "desc" },
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { id: true, versionLabel: true, content: true, createdAt: true },
          },
        },
      },
      scenes: {
        orderBy: { number: "asc" },
        take: 120,
        select: { id: true, number: true, heading: true, summary: true, storyDay: true },
      },
      castingRoles: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, description: true, status: true, dailyRate: true },
      },
      crewRoleNeeds: { orderBy: { createdAt: "asc" } },
      distributionSubmissions: { orderBy: { createdAt: "desc" }, take: 10 },
      finalDeliveries: { orderBy: { createdAt: "desc" }, take: 3 },
      postProductionReviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          notes: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, body: true, createdAt: true } },
        },
      },
      footageAssets: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, label: true, type: true, fileUrl: true, createdAt: true },
      },
      visualAssets: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true, category: true, imageUrl: true, caption: true },
      },
      musicSelections: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, usage: true, notes: true, track: { select: { title: true, artistName: true } } },
      },
      ideas: {
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, title: true, logline: true, notes: true, genres: true },
      },
      projectBudgets: {
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          isDefault: true,
          currency: true,
          totalPlanned: true,
          generationSource: true,
          updatedAt: true,
          _count: { select: { lines: true } },
        },
      },
      linkedCatalogueContent: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          reviewStatus: true,
          type: true,
          submittedAt: true,
          videoUrl: true,
          trailerUrl: true,
          scriptUrl: true,
          posterUrl: true,
          tags: true,
          minAge: true,
          advisory: true,
        },
      },
      _count: {
        select: {
          breakdownCharacters: true,
          breakdownProps: true,
          breakdownLocations: true,
          shootDays: true,
          callSheets: true,
          projectTasks: true,
          projectContracts: true,
          incidentReports: true,
          dailiesClips: true,
          equipmentPlanItems: true,
          tableReadSessions: true,
          members: true,
        },
      },
    },
  });

  if (!project) return null;

  const latestPitch = project.pitches[0] ?? null;
  const originalBadge = getStoryTimeOriginalBadge(latestPitch);

  const ideaCountByProject = new Map<string, number>([[projectId, project.ideas.length]]);
  const signalsMap = await loadProjectUsageSignals([projectId], ideaCountByProject);
  const signals = signalsMap.get(projectId);

  const stored = project.toolProgress.map((t) => ({
    toolId: t.toolId,
    phase: t.phase,
    status: t.status,
    percent: t.percent,
  }));
  const resolvedTools = resolveToolProgressForProject({
    projectStatus: project.status,
    stored,
    signals: signals ?? {
      ideaCount: project.ideas.length,
      scriptCount: 0,
      scriptReviewCount: 0,
      sceneCount: 0,
      breakdownCharacterCount: 0,
      budgetLineCount: 0,
      shootDayCount: 0,
      castingRoleCount: 0,
      crewNeedCount: 0,
      equipmentItemCount: 0,
      contractCount: 0,
      taskCount: 0,
      tableReadCount: 0,
      riskItemCount: 0,
      callSheetCount: 0,
      incidentCount: 0,
      dailiesClipCount: 0,
      contentLinked: project.linkedCatalogueContent.length > 0,
    },
    hubToolsOnly: true,
  });
  const pipelineRollup = buildPipelineRollup(resolvedTools, project.status);

  const creatorsById = new Map<
    string,
    {
      id: string;
      name: string | null;
      email: string | null;
      networkHandle: string | null;
      image: string | null;
      bio: string | null;
      headline: string | null;
      location: string | null;
      website: string | null;
      role: string;
      professionalName: string | null;
      primaryRole: string | null;
      createdAt: Date;
      isLead: boolean;
      pitchCount: number;
    }
  >();

  for (const pitch of project.pitches) {
    const c = pitch.creator;
    const existing = creatorsById.get(c.id);
    if (existing) {
      existing.pitchCount += 1;
    } else {
      creatorsById.set(c.id, {
        ...c,
        isLead: pitch.id === latestPitch?.id,
        pitchCount: 1,
      });
    }
  }

  // Members who are creators but not in pitches
  for (const m of project.members) {
    if (!creatorsById.has(m.user.id) && (m.role === "Creator" || m.role === "Lead Creator")) {
      creatorsById.set(m.user.id, {
        ...m.user,
        isLead: m.role === "Lead Creator",
        pitchCount: 0,
      });
    }
  }

  const linkedWithScripts = await Promise.all(
    project.linkedCatalogueContent.map(async (c) => {
      const versionId = parsePlatformScriptVersionId(c.tags);
      let platformScript: {
        versionId: string;
        versionLabel: string | null;
        scriptTitle: string;
        preview: string;
        characterCount: number;
        truncated: boolean;
      } | null = null;
      if (versionId) {
        const version = await prisma.projectScriptVersion.findUnique({
          where: { id: versionId },
          select: {
            id: true,
            versionLabel: true,
            content: true,
            script: { select: { title: true } },
          },
        });
        if (version) {
          platformScript = {
            versionId: version.id,
            versionLabel: version.versionLabel,
            scriptTitle: version.script.title,
            preview: version.content.slice(0, 12000),
            characterCount: version.content.length,
            truncated: version.content.length > 12000,
          };
        }
      }
      return { ...c, platformScript };
    }),
  );

  return {
    project: {
      id: project.id,
      title: project.title,
      logline: project.logline,
      synopsis: project.synopsis,
      type: project.type,
      genre: project.genre,
      status: project.status,
      phase: project.phase,
      budget: project.budget,
      targetDate: project.targetDate,
      posterUrl: project.posterUrl,
      adminNote: project.adminNote,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      isStoryTimeOriginal: isStoryTimeOriginalGreenlit(latestPitch),
      originalBadge,
    },
    creators: [...creatorsById.values()],
    pitches: project.pitches.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      synopsis: p.synopsis,
      logline: p.logline,
      scriptUrl: p.scriptUrl,
      treatmentUrl: p.treatmentUrl,
      lookbookUrl: p.lookbookUrl,
      budgetEst: p.budgetEst,
      adminNote: p.adminNote,
      reviewWeightedScore: p.reviewWeightedScore,
      createdAt: p.createdAt,
      creator: {
        id: p.creator.id,
        name: p.creator.name,
        email: p.creator.email,
        networkHandle: p.creator.networkHandle,
      },
    })),
    team: project.members.map((m) => ({
      id: m.id,
      role: m.role,
      department: m.department,
      status: m.status,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      networkHandle: m.user.networkHandle,
      image: m.user.image,
      headline: m.user.headline,
      location: m.user.location,
      bio: m.user.bio,
      userRole: m.user.role,
      professionalName: m.user.professionalName,
    })),
    toolProgress: resolvedTools.map((t) => ({
      toolId: t.toolId,
      label: toolLabel(t.toolId),
      phase: t.phase,
      status: t.status,
      percent: t.percent,
    })),
    pipelineRollup,
    scripts: project.scripts.map((s) => ({
      id: s.id,
      title: s.title,
      versions: s.versions.map((v) => ({
        id: v.id,
        versionLabel: v.versionLabel,
        createdAt: v.createdAt,
        preview: v.content.slice(0, 12000),
        characterCount: v.content.length,
        truncated: v.content.length > 12000,
      })),
    })),
    scenes: project.scenes,
    casting: project.castingRoles.map((r) => ({
      role: r.name,
      description: r.description,
      status: r.status,
      dailyRate: r.dailyRate,
    })),
    crew: project.crewRoleNeeds.map((n) => ({
      role: n.role,
      department: n.department,
      seniority: n.seniority,
      notes: n.notes,
      dailyRate: n.dailyRate,
    })),
    budgets: project.projectBudgets.map((b) => ({
      id: b.id,
      name: b.name,
      isDefault: b.isDefault,
      currency: b.currency,
      totalPlanned: b.totalPlanned,
      generationSource: b.generationSource,
      lineCount: b._count.lines,
      updatedAt: b.updatedAt,
    })),
    distribution: project.distributionSubmissions,
    finalDeliveries: project.finalDeliveries,
    postProductionReviews: project.postProductionReviews,
    footage: project.footageAssets,
    visualAssets: project.visualAssets,
    music: project.musicSelections.map((m) => ({
      id: m.id,
      usage: m.usage,
      notes: m.notes,
      trackTitle: m.track.title,
      artist: m.track.artistName,
    })),
    ideas: project.ideas,
    linkedContent: linkedWithScripts,
    activityCounts: {
      ...project._count,
      scripts: project.scripts.length,
      scenes: project.scenes.length,
      castingRoles: project.castingRoles.length,
      crewNeeds: project.crewRoleNeeds.length,
      ideas: project.ideas.length,
      linkedCatalogue: project.linkedCatalogueContent.length,
      budgets: project.projectBudgets.length,
    },
    breakdownCounts: project._count,
  };
}
