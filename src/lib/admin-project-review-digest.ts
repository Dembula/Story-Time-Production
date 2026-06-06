import { prisma } from "@/lib/prisma";
import { ALL_PROJECT_TOOLS } from "@/lib/project-tools";
import { getStoryTimeOriginalBadge, isStoryTimeOriginalGreenlit } from "@/lib/storytime-original";
import { parsePlatformScriptVersionId } from "@/lib/content-catalogue-tags";

function toolLabel(toolId: string): string {
  return ALL_PROJECT_TOOLS.find((t) => t.id === toolId)?.label ?? toolId;
}

export async function buildAdminProjectReviewDigest(projectId: string) {
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      pitches: { orderBy: { createdAt: "desc" }, take: 3 },
      members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      toolProgress: { orderBy: { updatedAt: "desc" } },
      scripts: {
        orderBy: { updatedAt: "desc" },
        include: {
          versions: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, versionLabel: true, content: true, createdAt: true } },
        },
      },
      scenes: {
        orderBy: { number: "asc" },
        take: 120,
        select: { id: true, number: true, heading: true, summary: true, storyDay: true },
      },
      castingRoles: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, description: true, status: true },
      },
      crewRoleNeeds: { orderBy: { createdAt: "asc" } },
      distributionSubmissions: { orderBy: { createdAt: "desc" }, take: 10 },
      finalDeliveries: { orderBy: { createdAt: "desc" }, take: 3 },
      postProductionReviews: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { notes: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, body: true, createdAt: true } } },
      },
      footageAssets: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, label: true, type: true, fileUrl: true, createdAt: true },
      },
      visualAssets: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, category: true, imageUrl: true, caption: true } },
      musicSelections: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, usage: true, notes: true, track: { select: { title: true, artistName: true } } },
      },
      ideas: { orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, title: true, logline: true, notes: true, genres: true } },
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
        },
      },
    },
  });

  if (!project) return null;

  const latestPitch = project.pitches[0] ?? null;
  const originalBadge = getStoryTimeOriginalBadge(latestPitch);

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
      posterUrl: project.posterUrl,
      isStoryTimeOriginal: isStoryTimeOriginalGreenlit(latestPitch),
      originalBadge,
    },
    pitches: project.pitches.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      synopsis: p.synopsis,
      scriptUrl: p.scriptUrl,
      treatmentUrl: p.treatmentUrl,
      lookbookUrl: p.lookbookUrl,
      adminNote: p.adminNote,
      reviewWeightedScore: p.reviewWeightedScore,
      createdAt: p.createdAt,
    })),
    team: project.members.map((m) => ({
      role: m.role,
      name: m.user.name,
      email: m.user.email,
      userRole: m.user.role,
    })),
    toolProgress: project.toolProgress.map((t) => ({
      toolId: t.toolId,
      label: toolLabel(t.toolId),
      phase: t.phase,
      status: t.status,
      percent: t.percent,
    })),
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
    })),
    crew: project.crewRoleNeeds.map((n) => ({
      role: n.role,
      department: n.department,
      seniority: n.seniority,
      notes: n.notes,
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
    breakdownCounts: project._count,
  };
}
