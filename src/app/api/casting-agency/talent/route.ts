import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta, type ActorMarketMeta } from "@/lib/marketplace-profile-meta";
import { parseTalentProfile, REPRESENTATION_TYPES } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";
import { validateStorageUrlField } from "@/lib/storage-origin";

export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! }, include: { talent: { orderBy: { sortOrder: "asc" } } } });
  if (!agency) return NextResponse.json([]);
  return NextResponse.json(
    agency.talent.map((row) => ({
      ...row,
      profile: parseTalentProfile(row),
    })),
  );
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to load talent roster.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! } });
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 400 });
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Talent name is required." }, { status: 400 });
  }
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
    body.representationType &&
    !REPRESENTATION_TYPES.includes(body.representationType)
  ) {
    return NextResponse.json({ error: "Invalid representation type." }, { status: 400 });
  }
  for (const [field, value] of [
    ["cvUrl", body.cvUrl],
    ["headshotUrl", body.headshotUrl],
    ["reelUrl", body.reelUrl],
  ] as const) {
    const error = validateStorageUrlField(value, field);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }
  const profile = body.profile ?? {};
  const talent = await prisma.castingTalent.create({
    data: {
      castingAgencyId: agency.id,
      name: body.name,
      agencyCommissionPercent:
        typeof body.agencyCommissionPercent === "number" ? body.agencyCommissionPercent : profile.agencyCommissionPercent ?? null,
      representationType: body.representationType ?? profile.representationType ?? null,
      bio: embedMeta(body.bio ?? null, {
        location: profile.location ?? null,
        languages: profile.languages ?? [],
        experienceLevel: profile.experienceLevel ?? null,
        dailyRate: profile.dailyRate ?? null,
        projectRate: profile.projectRate ?? null,
        hourlyRate: profile.hourlyRate ?? null,
        weeklyRate: profile.weeklyRate ?? null,
        availability: profile.availability ?? null,
        availabilityStatus: profile.availabilityStatus ?? null,
        agencyCommissionPercent:
          typeof body.agencyCommissionPercent === "number"
            ? body.agencyCommissionPercent
            : profile.agencyCommissionPercent ?? null,
        contactVisibility: profile.contactVisibility ?? "PRIVATE",
      } satisfies ActorMarketMeta),
      cvUrl: body.cvUrl ?? null,
      headshotUrl: body.headshotUrl ?? null,
      ageRange: body.ageRange ?? null,
      ethnicity: body.ethnicity ?? null,
      gender: body.gender ?? null,
      skills: body.skills ?? null,
      pastWork: body.pastWork ?? null,
      reelUrl: body.reelUrl ?? null,
      contactEmail: body.contactEmail ?? null,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json({ ...talent, profile: parseTalentProfile(talent) });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to add talent.");
    return NextResponse.json({ error: message }, { status });
  }
}
