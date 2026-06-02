import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AVAILABILITY_STATUSES, getAgencyForUser, requireCastingAgencySession } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const { id } = await params;
  const body = (await req.json()) as {
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    projectLabel?: string | null;
    notes?: string | null;
  };

  const existing = await prisma.castingTalentAvailability.findFirst({
    where: { id, talent: { castingAgencyId: agency.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    body.status &&
    !AVAILABILITY_STATUSES.includes(body.status as (typeof AVAILABILITY_STATUSES)[number])
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const updated = await prisma.castingTalentAvailability.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
      endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
      projectLabel: body.projectLabel !== undefined ? body.projectLabel : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    },
    include: { talent: { select: { id: true, name: true, headshotUrl: true } } },
  });

  return NextResponse.json(updated);
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to update availability.");
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const { id } = await params;
  const existing = await prisma.castingTalentAvailability.findFirst({
    where: { id, talent: { castingAgencyId: agency.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.castingTalentAvailability.delete({ where: { id } });
  return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to delete availability.");
    return NextResponse.json({ error: message }, { status });
  }
}
