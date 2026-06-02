import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AVAILABILITY_STATUSES, getAgencyForUser, requireCastingAgencySession } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";

export async function GET(req: Request) {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const talentId = searchParams.get("talentId");

  const blocks = await prisma.castingTalentAvailability.findMany({
    where: {
      talent: { castingAgencyId: agency.id },
      ...(talentId ? { talentId } : {}),
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    include: {
      talent: { select: { id: true, name: true, headshotUrl: true } },
    },
  });

  const roster = await prisma.castingTalent.findMany({
    where: { castingAgencyId: agency.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      headshotUrl: true,
      bio: true,
      agencyCommissionPercent: true,
      representationType: true,
      availabilityBlocks: {
        orderBy: { startDate: "asc" },
        take: 3,
      },
    },
  });

  return NextResponse.json({ blocks, roster });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to load availability.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const body = (await req.json()) as {
    talentId?: string;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    projectLabel?: string | null;
    notes?: string | null;
  };

  if (!body.talentId) {
    return NextResponse.json({ error: "talentId is required." }, { status: 400 });
  }

  const talent = await prisma.castingTalent.findFirst({
    where: { id: body.talentId, castingAgencyId: agency.id },
  });
  if (!talent) return NextResponse.json({ error: "Talent not found." }, { status: 404 });

  const status =
    body.status && AVAILABILITY_STATUSES.includes(body.status as (typeof AVAILABILITY_STATUSES)[number])
      ? body.status
      : "AVAILABLE";

  const block = await prisma.castingTalentAvailability.create({
    data: {
      talentId: body.talentId,
      status,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      projectLabel: body.projectLabel ?? null,
      notes: body.notes ?? null,
    },
    include: { talent: { select: { id: true, name: true, headshotUrl: true } } },
  });

  return NextResponse.json(block);
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to save availability block.");
    return NextResponse.json({ error: message }, { status });
  }
}
