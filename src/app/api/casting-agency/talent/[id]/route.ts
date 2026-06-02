import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta, parseEmbeddedMeta, type ActorMarketMeta } from "@/lib/marketplace-profile-meta";
import { parseTalentProfile, REPRESENTATION_TYPES } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";
import { validateStorageUrlField } from "@/lib/storage-origin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const talent = await prisma.castingTalent.findUnique({
    where: { id },
    include: {
      castingAgency: true,
      availabilityBlocks: { orderBy: { startDate: "asc" } },
      auditionSubmissions: {
        orderBy: { submittedAt: "desc" },
        take: 20,
        include: {
          auditionPost: {
            include: { content: { select: { title: true } }, creator: { select: { name: true } } },
          },
        },
      },
      castingInvitations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { project: { select: { title: true } }, role: { select: { name: true } } },
      },
      projectContracts: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { project: { select: { title: true } } },
      },
    },
  });
  if (!talent || talent.castingAgency.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...talent, profile: parseTalentProfile(talent) });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to load talent.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const talent = await prisma.castingTalent.findUnique({ where: { id }, include: { castingAgency: true } });
  if (!talent || talent.castingAgency.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();

  if (
    body.agencyCommissionPercent !== undefined &&
    body.agencyCommissionPercent !== null &&
    (typeof body.agencyCommissionPercent !== "number" ||
      body.agencyCommissionPercent < 0 ||
      body.agencyCommissionPercent > 100)
  ) {
    return NextResponse.json({ error: "Commission must be between 0 and 100." }, { status: 400 });
  }

  if (
    body.representationType !== undefined &&
    body.representationType !== null &&
    !REPRESENTATION_TYPES.includes(body.representationType)
  ) {
    return NextResponse.json({ error: "Invalid representation type." }, { status: 400 });
  }

  for (const [field, value] of [
    ["cvUrl", body.cvUrl],
    ["headshotUrl", body.headshotUrl],
    ["reelUrl", body.reelUrl],
  ] as const) {
    if (value === undefined) continue;
    const error = validateStorageUrlField(value, field);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }
  const currentMeta = parseEmbeddedMeta<ActorMarketMeta>(talent.bio).meta;
  const profile = body.profile ?? {};
  const updated = await prisma.castingTalent.update({
    where: { id },
    data: {
      name: body.name ?? talent.name,
      agencyCommissionPercent:
        body.agencyCommissionPercent !== undefined
          ? body.agencyCommissionPercent
          : profile.agencyCommissionPercent !== undefined
            ? profile.agencyCommissionPercent
            : talent.agencyCommissionPercent,
      representationType:
        body.representationType !== undefined
          ? body.representationType
          : profile.representationType !== undefined
            ? profile.representationType
            : talent.representationType,
      bio:
        body.bio !== undefined ||
        body.profile !== undefined ||
        body.agencyCommissionPercent !== undefined
          ? embedMeta(body.bio ?? parseEmbeddedMeta<ActorMarketMeta>(talent.bio).plain, {
              location: profile.location ?? currentMeta?.location ?? null,
              languages: profile.languages ?? currentMeta?.languages ?? [],
              experienceLevel: profile.experienceLevel ?? currentMeta?.experienceLevel ?? null,
              dailyRate: profile.dailyRate ?? currentMeta?.dailyRate ?? null,
              projectRate: profile.projectRate ?? currentMeta?.projectRate ?? null,
              hourlyRate: profile.hourlyRate ?? currentMeta?.hourlyRate ?? null,
              weeklyRate: profile.weeklyRate ?? currentMeta?.weeklyRate ?? null,
              availability: profile.availability ?? currentMeta?.availability ?? null,
              availabilityStatus: profile.availabilityStatus ?? currentMeta?.availabilityStatus ?? null,
              agencyCommissionPercent:
                body.agencyCommissionPercent !== undefined
                  ? body.agencyCommissionPercent
                  : profile.agencyCommissionPercent ?? currentMeta?.agencyCommissionPercent ?? talent.agencyCommissionPercent ?? null,
              contactVisibility: profile.contactVisibility ?? currentMeta?.contactVisibility ?? "PRIVATE",
            } satisfies ActorMarketMeta)
          : talent.bio,
      cvUrl: body.cvUrl !== undefined ? body.cvUrl : talent.cvUrl,
      headshotUrl: body.headshotUrl !== undefined ? body.headshotUrl : talent.headshotUrl,
      ageRange: body.ageRange !== undefined ? body.ageRange : talent.ageRange,
      ethnicity: body.ethnicity !== undefined ? body.ethnicity : talent.ethnicity,
      gender: body.gender !== undefined ? body.gender : talent.gender,
      skills: body.skills !== undefined ? body.skills : talent.skills,
      pastWork: body.pastWork !== undefined ? body.pastWork : talent.pastWork,
      reelUrl: body.reelUrl !== undefined ? body.reelUrl : talent.reelUrl,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail : talent.contactEmail,
      sortOrder: body.sortOrder !== undefined ? body.sortOrder : talent.sortOrder,
    },
  });
  return NextResponse.json({ ...updated, profile: parseTalentProfile(updated) });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to save talent.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const talent = await prisma.castingTalent.findUnique({ where: { id }, include: { castingAgency: true } });
  if (!talent || talent.castingAgency.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.castingTalent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to delete talent.");
    return NextResponse.json({ error: message }, { status });
  }
}
