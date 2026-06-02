import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUDITION_SUBMISSION_STATUSES, getAgencyForUser, requireCastingAgencySession } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";

export async function GET(req: Request) {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "all";

  const [openAuditions, submissions] = await Promise.all([
    prisma.auditionPost.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: {
        content: { select: { id: true, title: true } },
        creator: { select: { id: true, name: true } },
        agencySubmissions: {
          where: { castingAgencyId: agency.id },
          include: { talent: { select: { id: true, name: true, headshotUrl: true } } },
        },
      },
    }),
    prisma.castingAuditionSubmission.findMany({
      where: { castingAgencyId: agency.id },
      orderBy: { submittedAt: "desc" },
      include: {
        talent: { select: { id: true, name: true, headshotUrl: true } },
        auditionPost: {
          include: {
            content: { select: { title: true } },
            creator: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  if (view === "submissions") {
    return NextResponse.json({ submissions });
  }
  if (view === "open") {
    return NextResponse.json({ openAuditions });
  }

  return NextResponse.json({ openAuditions, submissions });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to load auditions.");
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
    auditionPostId?: string;
    talentId?: string;
    notes?: string;
    status?: string;
  };

  if (!body.auditionPostId || !body.talentId) {
    return NextResponse.json({ error: "auditionPostId and talentId are required." }, { status: 400 });
  }

  const talent = await prisma.castingTalent.findFirst({
    where: { id: body.talentId, castingAgencyId: agency.id },
  });
  if (!talent) return NextResponse.json({ error: "Talent not found in your roster." }, { status: 404 });

  const audition = await prisma.auditionPost.findUnique({ where: { id: body.auditionPostId } });
  if (!audition || audition.status !== "OPEN") {
    return NextResponse.json({ error: "Audition is not open." }, { status: 400 });
  }

  const status =
    body.status && AUDITION_SUBMISSION_STATUSES.includes(body.status as (typeof AUDITION_SUBMISSION_STATUSES)[number])
      ? body.status
      : "SUBMITTED";

  const submission = await prisma.castingAuditionSubmission.upsert({
    where: {
      auditionPostId_talentId: {
        auditionPostId: body.auditionPostId,
        talentId: body.talentId,
      },
    },
    create: {
      auditionPostId: body.auditionPostId,
      talentId: body.talentId,
      castingAgencyId: agency.id,
      notes: body.notes ?? null,
      status,
    },
    update: {
      notes: body.notes ?? undefined,
      status,
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

  return NextResponse.json(submission);
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to save audition submission.");
    return NextResponse.json({ error: message }, { status });
  }
}
