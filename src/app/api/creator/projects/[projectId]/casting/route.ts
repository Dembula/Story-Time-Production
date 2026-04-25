import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta, type ActorMarketMeta, listIncludes, embedMeta } from "@/lib/marketplace-profile-meta";

type CastingRoleMeta = {
  ageRange?: string | null;
  gender?: string | null;
  requiredTraits?: string | null;
  numberOfScenes?: number | null;
  shootDaysRequired?: number | null;
};

const ROLE_LINK_MARKER_PREFIX = "castingRoleId:";

function roleMarker(roleId: string) {
  return `${ROLE_LINK_MARKER_PREFIX}${roleId}`;
}

async function ensureCastingAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId, project };
}

// List casting roles for this project with basic invitation counts
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCastingAccess(projectId);
  if (access.error) return access.error;

  const roles = await prisma.castingRole.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      invitations: true,
      breakdownCharacter: {
        include: {
          scene: { select: { id: true } },
        },
      },
    },
  });
  const shootDays = await prisma.shootDay.findMany({
    where: { projectId },
    select: { id: true, scenes: { select: { sceneId: true } } },
  });
  const sceneToShootDayCount = new Map<string, number>();
  for (const day of shootDays) {
    for (const link of day.scenes) {
      sceneToShootDayCount.set(link.sceneId, (sceneToShootDayCount.get(link.sceneId) ?? 0) + 1);
    }
  }

  const roleMarkers = roles.map((r) => roleMarker(r.id));
  const [budget, roster] = await Promise.all([
    prisma.projectBudget.findUnique({
      where: { projectId },
      include: { lines: true },
    }),
    prisma.creatorCastRoster.findMany({
      where: { creatorId: access.userId! },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const searchLocation = req.nextUrl.searchParams.get("location");
  const searchExperience = req.nextUrl.searchParams.get("experienceLevel");
  const searchSkills = req.nextUrl.searchParams.get("skills");
  const searchAvailability = req.nextUrl.searchParams.get("availability");
  const minRate = Number(req.nextUrl.searchParams.get("minRate") ?? "");
  const maxRate = Number(req.nextUrl.searchParams.get("maxRate") ?? "");
  const agencies = await prisma.castingAgency.findMany({
    include: {
      talent: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const marketplace = agencies
    .map((agency) => ({
      id: agency.id,
      agencyName: agency.agencyName,
      location: [agency.city, agency.country].filter(Boolean).join(", ") || null,
      talent: agency.talent
        .map((person) => {
          const parsed = parseEmbeddedMeta<ActorMarketMeta>(person.bio);
          const skills = person.skills ?? "";
          const dailyRate = parsed.meta?.dailyRate ?? null;
          const withinMin = Number.isFinite(minRate) ? (dailyRate ?? 0) >= minRate : true;
          const withinMax = Number.isFinite(maxRate) ? (dailyRate ?? 0) <= maxRate : true;
          if (!withinMin || !withinMax) return null;
          if (searchLocation && !(parsed.meta?.location ?? "").toLowerCase().includes(searchLocation.toLowerCase())) return null;
          if (searchExperience && !(parsed.meta?.experienceLevel ?? "").toLowerCase().includes(searchExperience.toLowerCase())) return null;
          if (searchAvailability && !(parsed.meta?.availability ?? "").toLowerCase().includes(searchAvailability.toLowerCase())) return null;
          if (!listIncludes(skills, searchSkills)) return null;
          return {
            id: person.id,
            fullName: person.name,
            profilePhoto: person.headshotUrl,
            ageRange: person.ageRange,
            gender: person.gender,
            location: parsed.meta?.location ?? null,
            languages: parsed.meta?.languages ?? [],
            skills: skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            experienceLevel: parsed.meta?.experienceLevel ?? null,
            showreel: person.reelUrl,
            pastWork: person.pastWork ?? parsed.plain,
            dailyRate,
            projectRate: parsed.meta?.projectRate ?? null,
            availability: parsed.meta?.availability ?? null,
            contactRestricted: (parsed.meta?.contactVisibility ?? "PRIVATE") !== "PUBLIC",
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    }))
    .filter((agency) => agency.talent.length > 0);

  return NextResponse.json({
    roles: roles.map((r) => ({
      ...(() => {
        const marker = roleMarker(r.id);
        const salaryLine = budget?.lines.find((line) => (line.notes ?? "").includes(marker)) ?? null;
        const castEntry =
          roster.find((entry) => (entry.notes ?? "").includes(marker)) ?? null;
        const roleMeta = parseEmbeddedMeta<CastingRoleMeta>(r.description).meta;
        return {
          linkedSalary: salaryLine
            ? {
                budgetLineId: salaryLine.id,
                amount: Number(salaryLine.unitCost ?? salaryLine.total ?? 0),
                notes: salaryLine.notes ?? null,
              }
            : null,
          assignedCast: castEntry
            ? {
                id: castEntry.id,
                name: castEntry.name,
                contactEmail: castEntry.contactEmail,
                notes: castEntry.notes,
              }
            : null,
          roleMeta,
        };
      })(),
      id: r.id,
      name: r.name,
      description: parseEmbeddedMeta<CastingRoleMeta>(r.description).plain,
      status: r.status,
      breakdownCharacterId: r.breakdownCharacterId,
      requiredTraits:
        parseEmbeddedMeta<CastingRoleMeta>(r.description).meta?.requiredTraits ??
        r.breakdownCharacter?.description ??
        null,
      ageRange: parseEmbeddedMeta<CastingRoleMeta>(r.description).meta?.ageRange ?? null,
      gender: parseEmbeddedMeta<CastingRoleMeta>(r.description).meta?.gender ?? null,
      numberOfScenes:
        parseEmbeddedMeta<CastingRoleMeta>(r.description).meta?.numberOfScenes ??
        (r.breakdownCharacter?.scene ? 1 : 0),
      shootDaysRequired:
        parseEmbeddedMeta<CastingRoleMeta>(r.description).meta?.shootDaysRequired ??
        (r.breakdownCharacter?.scene
          ? sceneToShootDayCount.get(r.breakdownCharacter.scene.id) ?? 0
          : 0),
      invitationsCount: r.invitations.length,
      castInvitations: r.invitations.filter((i) => i.status === "ACCEPTED").length,
    })),
    marketplace,
  });
}

// Create or update a casting role
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCastingAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        name: string;
        description?: string | null;
        breakdownCharacterId?: string | null;
        ageRange?: string | null;
        gender?: string | null;
        requiredTraits?: string | null;
        numberOfScenes?: number | null;
        shootDaysRequired?: number | null;
      }
    | null;

  if (!body?.name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const role = await prisma.castingRole.create({
    data: {
      projectId,
      name: body.name,
      description: embedMeta(body.description ?? null, {
        ageRange: body.ageRange ?? null,
        gender: body.gender ?? null,
        requiredTraits: body.requiredTraits ?? null,
        numberOfScenes: body.numberOfScenes ?? null,
        shootDaysRequired: body.shootDaysRequired ?? null,
      }),
      breakdownCharacterId: body.breakdownCharacterId ?? null,
    },
  });

  return NextResponse.json({ role }, { status: 201 });
}

// Lightweight updates for role status/description
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureCastingAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        name?: string;
        description?: string | null;
        status?: string;
        actorName?: string | null;
        actorEmail?: string | null;
        actorNotes?: string | null;
        salaryAmount?: number | null;
        salaryNotes?: string | null;
        markCast?: boolean;
        ageRange?: string | null;
        gender?: string | null;
        requiredTraits?: string | null;
        numberOfScenes?: number | null;
        shootDaysRequired?: number | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const marker = roleMarker(body.id);
  const role = await prisma.$transaction(async (tx) => {
    const existingRole = await tx.castingRole.findUnique({ where: { id: body.id } });
    if (!existingRole || existingRole.projectId !== projectId) {
      throw new Error("Role not found");
    }

    const nextRole = await tx.castingRole.update({
      where: { id: body.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ||
        body.ageRange !== undefined ||
        body.gender !== undefined ||
        body.requiredTraits !== undefined ||
        body.numberOfScenes !== undefined ||
        body.shootDaysRequired !== undefined
          ? {
              description: embedMeta(
                body.description ?? parseEmbeddedMeta<CastingRoleMeta>(existingRole.description).plain,
                {
                  ageRange: body.ageRange ?? parseEmbeddedMeta<CastingRoleMeta>(existingRole.description).meta?.ageRange ?? null,
                  gender: body.gender ?? parseEmbeddedMeta<CastingRoleMeta>(existingRole.description).meta?.gender ?? null,
                  requiredTraits:
                    body.requiredTraits ??
                    parseEmbeddedMeta<CastingRoleMeta>(existingRole.description).meta?.requiredTraits ??
                    null,
                  numberOfScenes:
                    body.numberOfScenes ??
                    parseEmbeddedMeta<CastingRoleMeta>(existingRole.description).meta?.numberOfScenes ??
                    null,
                  shootDaysRequired:
                    body.shootDaysRequired ??
                    parseEmbeddedMeta<CastingRoleMeta>(existingRole.description).meta?.shootDaysRequired ??
                    null,
                },
              ),
            }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.markCast === true ? { status: "CAST" } : {}),
      },
    });

    if (body.salaryAmount !== undefined && body.salaryAmount !== null) {
      const budget = await tx.projectBudget.upsert({
        where: { projectId },
        create: {
          projectId,
          template: "SHORT_FILM",
          currency: "ZAR",
          totalPlanned: 0,
        },
        update: {},
      });
      const existingLine = await tx.projectBudgetLine.findFirst({
        where: {
          budgetId: budget.id,
          notes: { contains: marker },
        },
      });
      const baseNotes = (body.salaryNotes ?? "").trim();
      const notesWithMarker = baseNotes
        ? `${baseNotes}\n[${marker}]`
        : `[${marker}]`;
      const nextAmount = Math.max(0, Number(body.salaryAmount) || 0);
      if (existingLine) {
        await tx.projectBudgetLine.update({
          where: { id: existingLine.id },
          data: {
            department: "CAST",
            name: `Salary · ${nextRole.name}`,
            quantity: 1,
            unitCost: nextAmount,
            total: nextAmount,
            notes: notesWithMarker,
          },
        });
      } else {
        await tx.projectBudgetLine.create({
          data: {
            budgetId: budget.id,
            department: "CAST",
            name: `Salary · ${nextRole.name}`,
            quantity: 1,
            unitCost: nextAmount,
            total: nextAmount,
            notes: notesWithMarker,
          },
        });
      }
    }

    if (body.actorName !== undefined) {
      const actorName = body.actorName?.trim() ?? "";
      const existingCast = await tx.creatorCastRoster.findFirst({
        where: {
          creatorId: access.userId!,
          notes: { contains: marker },
        },
      });
      if (!actorName) {
        if (existingCast) {
          await tx.creatorCastRoster.delete({ where: { id: existingCast.id } });
        }
      } else if (existingCast) {
        await tx.creatorCastRoster.update({
          where: { id: existingCast.id },
          data: {
            name: actorName,
            roleType: "Actor",
            contactEmail: body.actorEmail ?? existingCast.contactEmail,
            notes: `${body.actorNotes ?? ""}\n[${marker}]`.trim(),
          },
        });
      } else {
        await tx.creatorCastRoster.create({
          data: {
            creatorId: access.userId!,
            name: actorName,
            roleType: "Actor",
            contactEmail: body.actorEmail ?? null,
            notes: `${body.actorNotes ?? ""}\n[${marker}]`.trim(),
          },
        });
      }
    }

    return nextRole;
  });

  return NextResponse.json({ role });
}

