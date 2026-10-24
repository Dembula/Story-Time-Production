import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageFestival,
  canStage1Review,
  canStage2Review,
  requireFestivalAccess,
  requireFestivalSession,
} from "@/lib/festival/access";
import { FESTIVAL_SELECTION, FESTIVAL_STATUS } from "@/lib/festival/constants";
import { packFestivalImageUrl, packFestivalVideoUrl } from "@/lib/festival/media-urls";

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

  const rawStills = submission.stillUrls;
  const stillUrls = Array.isArray(rawStills)
    ? rawStills
        .filter((u): u is string => typeof u === "string")
        .map((u) => packFestivalImageUrl(u) ?? u)
    : [];

  return NextResponse.json({
    submission: {
      ...submission,
      screenerUrl: packFestivalVideoUrl(submission.screenerUrl) ?? submission.screenerUrl,
      trailerUrl: packFestivalVideoUrl(submission.trailerUrl) ?? submission.trailerUrl,
      stillUrls,
    },
    membershipRole: access.membershipRole,
    canStage2: canStage2Review(access.membershipRole, auth.role === "ADMIN"),
    canManage: canManageFestival(access.membershipRole, auth.role === "ADMIN"),
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

  /**
   * Placement controls: escalate / de-escalate / official selection / re-review.
   * Stage 2 reviewers + festival admins can place; Stage 1 can escalate only.
   */
  if (body.action === "manage" || body.action === "quick") {
    const isAdminish = canManageFestival(access.membershipRole, auth.role === "ADMIN");
    const isStage2 = canStage2Review(access.membershipRole, auth.role === "ADMIN");
    const isStage1 = canStage1Review(access.membershipRole, auth.role === "ADMIN");
    const intent =
      typeof body.intent === "string" ? body.intent : body.action === "quick" ? null : "manage";

    if (intent === "escalate") {
      if (!isStage1) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const updated = await prisma.festivalSubmission.update({
        where: { id: submissionId },
        data: {
          reviewStage: "STAGE2",
          escalateFlag: true,
          stage1Group: submission.stage1Group === "C" ? "B" : submission.stage1Group || "A",
          selectionStatus: FESTIVAL_SELECTION.PENDING_APPROVAL,
        },
        include: {
          festival: { select: { id: true, name: true, status: true } },
          category: true,
          creator: { select: { id: true, name: true, email: true } },
          stage1Reviews: true,
          stage2Reviews: true,
        },
      });
      return NextResponse.json({ submission: updated });
    }

    if (intent === "deescalate") {
      if (!isStage2 && !isAdminish) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await prisma.festivalSubmission.update({
        where: { id: submissionId },
        data: {
          reviewStage: "STAGE1",
          escalateFlag: false,
          selectionStatus: FESTIVAL_SELECTION.PENDING_APPROVAL,
          screeningOrder: null,
        },
        include: {
          festival: { select: { id: true, name: true, status: true } },
          category: true,
          creator: { select: { id: true, name: true, email: true } },
          stage1Reviews: true,
          stage2Reviews: true,
        },
      });
      return NextResponse.json({ submission: updated });
    }

    if (intent === "rereview") {
      if (!isStage2 && !isAdminish) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await prisma.festivalSubmission.update({
        where: { id: submissionId },
        data: {
          reviewStage: "STAGE1",
          escalateFlag: false,
          stage1Group: null,
          tags: [],
          selectionStatus: FESTIVAL_SELECTION.PENDING_APPROVAL,
          screeningOrder: null,
        },
        include: {
          festival: { select: { id: true, name: true, status: true } },
          category: true,
          creator: { select: { id: true, name: true, email: true } },
          stage1Reviews: true,
          stage2Reviews: true,
        },
      });
      return NextResponse.json({ submission: updated });
    }

    if (intent === "official") {
      if (!isStage2 && !isAdminish) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      let screeningOrder = submission.screeningOrder;
      if (screeningOrder == null) {
        const max = await prisma.festivalSubmission.aggregate({
          where: {
            festivalId: submission.festivalId,
            selectionStatus: FESTIVAL_SELECTION.OFFICIAL_SELECTION,
          },
          _max: { screeningOrder: true },
        });
        screeningOrder = (max._max.screeningOrder ?? 0) + 1;
      }
      const updated = await prisma.festivalSubmission.update({
        where: { id: submissionId },
        data: {
          reviewStage: "STAGE2",
          escalateFlag: true,
          selectionStatus: FESTIVAL_SELECTION.OFFICIAL_SELECTION,
          screeningOrder,
        },
        include: {
          festival: { select: { id: true, name: true, status: true } },
          category: true,
          creator: { select: { id: true, name: true, email: true } },
          stage1Reviews: true,
          stage2Reviews: true,
        },
      });
      return NextResponse.json({ submission: updated });
    }

    if (intent === "remove_official") {
      if (!isStage2 && !isAdminish) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await prisma.festivalSubmission.update({
        where: { id: submissionId },
        data: {
          selectionStatus: FESTIVAL_SELECTION.PENDING_APPROVAL,
          screeningOrder: null,
          reviewStage: "STAGE2",
        },
        include: {
          festival: { select: { id: true, name: true, status: true } },
          category: true,
          creator: { select: { id: true, name: true, email: true } },
          stage1Reviews: true,
          stage2Reviews: true,
        },
      });
      return NextResponse.json({ submission: updated });
    }

    // Full manage form (stage / group / selection fields)
    if (!isStage2 && !isAdminish) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: {
      reviewStage?: string;
      stage1Group?: string | null;
      escalateFlag?: boolean;
      selectionStatus?: string;
      screeningOrder?: number | null;
      tags?: string[];
    } = {};

    if (body.reviewStage === "STAGE1" || body.reviewStage === "STAGE2") {
      data.reviewStage = body.reviewStage;
      if (body.reviewStage === "STAGE1") {
        data.escalateFlag = false;
        if (body.selectionStatus == null) {
          data.selectionStatus = FESTIVAL_SELECTION.PENDING_APPROVAL;
          data.screeningOrder = null;
        }
      }
    }

    if (body.stage1Group === null || body.clearGroup === true) {
      data.stage1Group = null;
    } else if (body.stage1Group === "A" || body.stage1Group === "B" || body.stage1Group === "C") {
      data.stage1Group = body.stage1Group;
      data.escalateFlag = body.stage1Group === "A" || Boolean(body.escalateFlag);
      if (data.escalateFlag && data.reviewStage == null) {
        data.reviewStage = "STAGE2";
      }
    }

    if (
      body.selectionStatus === FESTIVAL_SELECTION.OFFICIAL_SELECTION ||
      body.selectionStatus === FESTIVAL_SELECTION.NOT_SELECTED ||
      body.selectionStatus === FESTIVAL_SELECTION.PENDING_APPROVAL
    ) {
      data.selectionStatus = body.selectionStatus;
      if (body.selectionStatus === FESTIVAL_SELECTION.OFFICIAL_SELECTION) {
        data.reviewStage = data.reviewStage ?? "STAGE2";
        if (submission.screeningOrder == null) {
          const max = await prisma.festivalSubmission.aggregate({
            where: {
              festivalId: submission.festivalId,
              selectionStatus: FESTIVAL_SELECTION.OFFICIAL_SELECTION,
            },
            _max: { screeningOrder: true },
          });
          data.screeningOrder = (max._max.screeningOrder ?? 0) + 1;
        }
      } else if (body.selectionStatus === FESTIVAL_SELECTION.NOT_SELECTED) {
        data.screeningOrder = null;
      } else if (body.selectionStatus === FESTIVAL_SELECTION.PENDING_APPROVAL) {
        data.screeningOrder = null;
      }
    }

    if (Array.isArray(body.tags)) {
      data.tags = body.tags.filter((t: unknown) => typeof t === "string");
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No manage fields provided." }, { status: 400 });
    }

    const updated = await prisma.festivalSubmission.update({
      where: { id: submissionId },
      data,
      include: {
        festival: { select: { id: true, name: true, status: true } },
        category: true,
        creator: { select: { id: true, name: true, email: true } },
        stage1Reviews: true,
        stage2Reviews: true,
      },
    });
    return NextResponse.json({ submission: updated });
  }

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
