import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUDITION_SUBMISSION_STATUSES, getAgencyForUser, requireCastingAgencySession } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const { id } = await params;
  const body = (await req.json()) as { status?: string; notes?: string };

  const existing = await prisma.castingAuditionSubmission.findFirst({
    where: { id, castingAgencyId: agency.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    body.status &&
    !AUDITION_SUBMISSION_STATUSES.includes(body.status as (typeof AUDITION_SUBMISSION_STATUSES)[number])
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const updated = await prisma.castingAuditionSubmission.update({
    where: { id },
    data: {
      status: body.status ?? undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    },
    include: {
      talent: { select: { id: true, name: true, headshotUrl: true } },
      auditionPost: {
        include: {
          content: { select: { title: true } },
          creator: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to update submission.");
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
  const existing = await prisma.castingAuditionSubmission.findFirst({
    where: { id, castingAgencyId: agency.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.castingAuditionSubmission.delete({ where: { id } });
  return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to delete submission.");
    return NextResponse.json({ error: message }, { status });
  }
}
