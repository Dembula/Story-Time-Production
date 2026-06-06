import { prisma } from "@/lib/prisma";

const ROLE_LINK_MARKER_PREFIX = "castingRoleId:";
const NEED_LINK_MARKER_PREFIX = "crewNeedId:";

function roleMarker(roleId: string) {
  return `${ROLE_LINK_MARKER_PREFIX}${roleId}`;
}

function needMarker(needId: string) {
  return `${NEED_LINK_MARKER_PREFIX}${needId}`;
}

export type ProjectUploadPrefill = {
  project: {
    id: string;
    title: string;
    logline: string | null;
    synopsis: string | null;
    genre: string | null;
    type: string;
    posterUrl: string | null;
  };
  script: {
    scriptId: string;
    versionId: string;
    title: string;
    versionLabel: string | null;
    preview: string;
    characterCount: number;
  } | null;
  crew: { name: string; role: string }[];
  cast: { name: string; role: string }[];
  distributionDraft: Record<string, unknown> | null;
  sources: {
    metadata: boolean;
    script: boolean;
    crew: boolean;
    cast: boolean;
  };
};

function mapProjectTypeToContentType(projectType: string): string {
  switch (projectType) {
    case "SHORT_FILM":
    case "INDIE_FILM":
    case "FEATURE_FILM":
      return "MOVIE";
    case "TV_EPISODE":
      return "SERIES";
    default:
      return "MOVIE";
  }
}

export async function getProjectUploadPrefill(
  projectId: string,
  userId: string,
): Promise<ProjectUploadPrefill | null> {
  const project = await prisma.originalProject.findFirst({
    where: {
      id: projectId,
      OR: [{ members: { some: { userId } } }, { pitches: { some: { creatorId: userId } } }],
    },
    select: {
      id: true,
      title: true,
      logline: true,
      synopsis: true,
      genre: true,
      type: true,
      posterUrl: true,
      scripts: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, versionLabel: true, content: true } },
        },
      },
      castingRoles: { select: { id: true, name: true } },
      crewRoleNeeds: { select: { id: true, role: true } },
      distributionSubmissions: {
        where: { status: { in: ["DRAFT", "PENDING"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { note: true },
      },
    },
  });

  if (!project) return null;

  const [castRoster, crewRoster] = await Promise.all([
    prisma.creatorCastRoster.findMany({ where: { creatorId: userId }, orderBy: { updatedAt: "desc" } }),
    prisma.creatorCrewRoster.findMany({ where: { creatorId: userId }, orderBy: { updatedAt: "desc" } }),
  ]);

  const scriptRow = project.scripts[0];
  const version = scriptRow?.versions[0] ?? null;
  const script =
    scriptRow && version
      ? {
          scriptId: scriptRow.id,
          versionId: version.id,
          title: scriptRow.title,
          versionLabel: version.versionLabel,
          preview: version.content.slice(0, 4000),
          characterCount: version.content.length,
        }
      : null;

  const cast = project.castingRoles
    .map((r) => {
      const entry = castRoster.find((c) => (c.notes ?? "").includes(roleMarker(r.id)));
      return entry ? { name: entry.name, role: r.name } : null;
    })
    .filter((c): c is { name: string; role: string } => Boolean(c));

  const crew = project.crewRoleNeeds
    .map((n) => {
      const entry = crewRoster.find((c) => (c.notes ?? "").includes(needMarker(n.id)));
      return entry ? { name: entry.name, role: n.role } : null;
    })
    .filter((c): c is { name: string; role: string } => Boolean(c));

  let distributionDraft: Record<string, unknown> | null = null;
  const draftNote = project.distributionSubmissions[0]?.note;
  if (draftNote) {
    try {
      distributionDraft = JSON.parse(draftNote) as Record<string, unknown>;
    } catch {
      distributionDraft = null;
    }
  }

  const metadataPrefill =
    distributionDraft && typeof distributionDraft.metadataPrefill === "object"
      ? (distributionDraft.metadataPrefill as Record<string, unknown>)
      : null;

  return {
    project: {
      id: project.id,
      title: (metadataPrefill?.title as string) || project.title,
      logline: project.logline,
      synopsis: (metadataPrefill?.description as string) || project.synopsis,
      genre: (metadataPrefill?.genre as string) || project.genre,
      type: project.type,
      posterUrl: project.posterUrl,
    },
    script,
    crew,
    cast,
    distributionDraft,
    sources: {
      metadata: Boolean(project.title || project.synopsis || project.logline || metadataPrefill),
      script: Boolean(script),
      crew: crew.length > 0,
      cast: cast.length > 0,
    },
  };
}

export function applyPrefillToUploadForm(prefill: ProjectUploadPrefill, mode: "platform" | "manual") {
  if (mode === "manual") {
    return {
      formPatch: {},
      selectedGenres: [] as string[],
      crew: [{ name: "", role: "" }],
      logline: "",
      contentType: "",
      platformScriptVersionId: null as string | null,
    };
  }

  const genre = prefill.project.genre?.trim();
  const description = [prefill.project.synopsis, prefill.project.logline].filter(Boolean).join("\n\n");

  const crewEntries =
    prefill.crew.length > 0 || prefill.cast.length > 0
      ? [
          ...prefill.cast.map((c) => ({ name: c.name, role: `Cast — ${c.role}` })),
          ...prefill.crew.map((c) => ({ name: c.name, role: c.role })),
        ]
      : [{ name: "", role: "" }];

  return {
    formPatch: {
      title: prefill.project.title,
      description,
      category: genre ?? "",
      posterUrl: prefill.project.posterUrl ?? "",
      type: mapProjectTypeToContentType(prefill.project.type),
    },
    selectedGenres: genre ? [genre] : [],
    crew: crewEntries,
    logline: prefill.project.logline ?? "",
    contentType: mapProjectTypeToContentType(prefill.project.type),
    platformScriptVersionId: prefill.script?.versionId ?? null,
  };
}
