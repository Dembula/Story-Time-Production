import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyUser } from "@/lib/notify-user";
import { sanitizeReviewFeedback } from "@/lib/review-feedback";
import { buildAppUrl } from "@/lib/app-url";

function reviewDetailUrl(contentId: string) {
  return `/creator/catalogue/reviews/${contentId}`;
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const adminId = (session?.user as { id?: string })?.id;
  if (role !== "ADMIN" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { contentId, action, reviewNote, featured, reviewFeedback: rawFeedback } = body;

  if (!contentId || !action) {
    return NextResponse.json({ error: "contentId and action required" }, { status: 400 });
  }

  const before = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      reviewStatus: true,
      published: true,
      creatorId: true,
      linkedProjectId: true,
    },
  });
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const feedbackList = sanitizeReviewFeedback(rawFeedback, before.linkedProjectId);
  const feedbackForDb =
    feedbackList === null ? Prisma.JsonNull : (feedbackList as Prisma.InputJsonValue);

  const baseAudit = {
    adminUserId: adminId,
    entityType: "Content",
    entityId: contentId,
    oldValue: {
      reviewStatus: before.reviewStatus,
      published: before.published,
    } as Prisma.InputJsonValue,
  };

  const notify = async (
    actionKey: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "UNPUBLISH",
    title: string,
    bodyText: string,
  ) => {
    const url = reviewDetailUrl(contentId);
    await notifyUser({
      userId: before.creatorId,
      type: "CONTENT_REVIEW_DECISION",
      title,
      body: bodyText,
      metadata: { url, contentId, action: actionKey },
      email: {
        subject: title,
        text: `${bodyText}\n\nOpen: ${buildAppUrl(url)}`,
      },
    });
  };

  if (action === "APPROVE") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "APPROVED",
        published: true,
        featured: featured ?? false,
        reviewNote: reviewNote || null,
        reviewFeedback: Prisma.JsonNull as unknown as Prisma.InputJsonValue,
        reviewedAt: now,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        ...baseAudit,
        action: "CONTENT_REVIEW_APPROVE",
        newValue: { reviewStatus: updated.reviewStatus, published: updated.published } as Prisma.InputJsonValue,
      },
    });
    await notify(
      "APPROVE",
      "Your catalogue title was approved",
      `"${before.title}" is approved and published on the catalogue.`,
    );
    return NextResponse.json(updated);
  }

  if (action === "REJECT") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "REJECTED",
        published: false,
        reviewNote: reviewNote || "Content did not meet platform guidelines.",
        reviewFeedback: feedbackForDb as unknown as Prisma.InputJsonValue,
        reviewedAt: now,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        ...baseAudit,
        action: "CONTENT_REVIEW_REJECT",
        newValue: {
          reviewStatus: updated.reviewStatus,
          reviewNote: updated.reviewNote,
        } as Prisma.InputJsonValue,
      },
    });
    await notify(
      "REJECT",
      "Catalogue submission declined",
      `Your submission "${before.title}" was not approved. Open Story Time for full details and next steps.`,
    );
    return NextResponse.json(updated);
  }

  if (action === "REQUEST_CHANGES") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "CHANGES_REQUESTED",
        published: false,
        reviewNote: reviewNote || "Please address the noted issues and resubmit.",
        reviewFeedback: feedbackForDb as unknown as Prisma.InputJsonValue,
        reviewedAt: now,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        ...baseAudit,
        action: "CONTENT_REVIEW_REQUEST_CHANGES",
        newValue: {
          reviewStatus: updated.reviewStatus,
          reviewNote: updated.reviewNote,
        } as Prisma.InputJsonValue,
      },
    });
    await notify(
      "REQUEST_CHANGES",
      "Changes requested on your catalogue submission",
      `Please update "${before.title}" and resubmit. We added guidance in your review page.`,
    );
    return NextResponse.json(updated);
  }

  if (action === "UNPUBLISH") {
    const updated = await prisma.content.update({
      where: { id: contentId },
      data: {
        reviewStatus: "UNPUBLISHED",
        published: false,
        reviewNote: reviewNote || null,
        reviewedAt: now,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        ...baseAudit,
        action: "CONTENT_REVIEW_UNPUBLISH",
        newValue: { reviewStatus: updated.reviewStatus, published: false } as Prisma.InputJsonValue,
      },
    });
    await notify(
      "UNPUBLISH",
      "A title was unpublished",
      `"${before.title}" is no longer public on the catalogue. See your review page for notes.`,
    );
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
