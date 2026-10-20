import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canStage1Review,
  canStage2Review,
  requireFestivalAccess,
  requireFestivalSession,
} from "@/lib/festival/access";
import { FESTIVAL_SELECTION, FESTIVAL_STATUS } from "@/lib/festival/constants";
import { packFestivalVideoUrl } from "@/lib/festival/media-urls";

type Ctx = { params: Promise<{ submissionId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { submissionId } = await ctx.params;

  const submission = await prisma.festivalSubmission.findUnique({
    where: { id: submissionId },
    include: {
      festival: { select: { id: true, name: true, status: true } },
      category: true,
      creator: { select: { id: true, name: true, email: true } },
      stage1Reviews: true,
      stage2Reviews: true,
    },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireFestivalAccess(submission.festivalId, auth.userId, auth.role === "ADMIN");
  if (!access || !canStage1Review(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    submission: {
      ...submission,
      screenerUrl: packFestivalVideoUrl(submission.screenerUrl) ?? submission.screenerUrl,
      trailerUrl: packFestivalVideoUrl(submission.trailerUrl) ?? submission.trailerUrl,
    },
    membershipRole: access.membershipRole,
    canStage2: canStage2Review(access.membershipRole, auth.role === "ADMIN"),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { submissionId } = await ctx.params;

  const submission = await prisma.festivalSubmission.findUnique({
    where: { id: submissionId },
    include: { festival: { select: { id: true, status: true } } },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (submission.festival.status === FESTIVAL_STATUS.ENDED) {
    return NextResponse.json({ error: "Festival has ended; reviews are frozen." }, { status: 400 });
  }
  if (submission.paymentStatus !== "PAID") {
    return NextResponse.json({ error: "Submission is not paid." }, { status: 400 });
  }

  const access = await requireFestivalAccess(submission.festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const stage = body.stage === "STAGE2" ? "STAGE2" : "STAGE1";

  if (stage === "STAGE1") {
    if (!canStage1Review(access.membershipRole, auth.role === "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const group = body.group === "A" || body.group === "B" || body.group === "C" ? body.group : null;
    if (!group) return NextResponse.json({ error: "Assign group A, B, or C." }, { status: 400 });

    const escalateFlag = Boolean(body.escalateFlag);
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [];
    if (group === "C" && tags.length === 0) {
      return NextResponse.json({ error: "Group C requires at least one tag." }, { status: 400 });
    }

    const shouldEscalate = group === "A" || (group === "B" && escalateFlag);

    await prisma.festivalStage1Review.upsert({
      where: {
        submissionId_reviewerUserId: { submissionId, reviewerUserId: auth.userId },
      },
      create: {
        submissionId,
        reviewerUserId: auth.userId,
        group,
        escalateFlag: group === "B" ? escalateFlag : group === "A",
        tags,
        note: typeof body.note === "string" ? body.note.trim() : null,
      },
      update: {
        group,
        escalateFlag: group === "B" ? escalateFlag : group === "A",
        tags,
        note: typeof body.note === "string" ? body.note.trim() : null,
      },
    });

    const updated = await prisma.festivalSubmission.update({
      where: { id: submissionId },
      data: {
        stage1Group: group,
        escalateFlag: shouldEscalate,
        tags,
        reviewStage: shouldEscalate ? "STAGE2" : "STAGE1",
        selectionStatus: FESTIVAL_SELECTION.PENDING_APPROVAL,
      },
      include: { stage1Reviews: true, stage2Reviews: true },
    });
    return NextResponse.json({ submission: updated });
  }

  // Stage 2
  if (!canStage2Review(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (submission.reviewStage !== "STAGE2" && !submission.escalateFlag && submission.stage1Group !== "A") {
    return NextResponse.json({ error: "Submission is not escalated to stage 2." }, { status: 400 });
  }

  const recommendation =
    body.recommendation === FESTIVAL_SELECTION.OFFICIAL_SELECTION ||
    body.recommendation === FESTIVAL_SELECTION.NOT_SELECTED ||
    body.recommendation === FESTIVAL_SELECTION.PENDING_APPROVAL
      ? body.recommendation
      : FESTIVAL_SELECTION.PENDING_APPROVAL;

  await prisma.festivalStage2Review.upsert({
    where: {
      submissionId_reviewerUserId: { submissionId, reviewerUserId: auth.userId },
    },
    create: {
      submissionId,
      reviewerUserId: auth.userId,
      overallThoughts: typeof body.overallThoughts === "string" ? body.overallThoughts.trim() : null,
      acceptReason: typeof body.acceptReason === "string" ? body.acceptReason.trim() : null,
      declineReason: typeof body.declineReason === "string" ? body.declineReason.trim() : null,
      craftNotes: typeof body.craftNotes === "string" ? body.craftNotes.trim() : null,
      recommendation,
    },
    update: {
      overallThoughts: typeof body.overallThoughts === "string" ? body.overallThoughts.trim() : null,
      acceptReason: typeof body.acceptReason === "string" ? body.acceptReason.trim() : null,
      declineReason: typeof body.declineReason === "string" ? body.declineReason.trim() : null,
      craftNotes: typeof body.craftNotes === "string" ? body.craftNotes.trim() : null,
      recommendation,
    },
  });

  let screeningOrder: number | undefined;
  if (recommendation === FESTIVAL_SELECTION.OFFICIAL_SELECTION && submission.screeningOrder == null) {
    const max = await prisma.festivalSubmission.aggregate({
      where: { festivalId: submission.festivalId, selectionStatus: FESTIVAL_SELECTION.OFFICIAL_SELECTION },
      _max: { screeningOrder: true },
    });
    screeningOrder = (max._max.screeningOrder ?? 0) + 1;
  }

  const updated = await prisma.festivalSubmission.update({
    where: { id: submissionId },
    data: {
      reviewStage: "STAGE2",
      selectionStatus: recommendation,
      screeningOrder:
        recommendation === FESTIVAL_SELECTION.OFFICIAL_SELECTION
          ? screeningOrder ?? submission.screeningOrder
          : recommendation === FESTIVAL_SELECTION.NOT_SELECTED
            ? null
            : undefined,
    },
    include: { stage1Reviews: true, stage2Reviews: true },
  });

  return NextResponse.json({ submission: updated });
}
