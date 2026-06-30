import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_STATUSES = [
  "PENDING_ADMIN_REVIEW",
  "IN_REVIEW",
  "NEEDS_REVISION",
  "COMPLETED",
] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statusFilter = req.nextUrl.searchParams.get("status");

  const requests = await prisma.scriptReviewRequest.findMany({
    where: statusFilter ? { status: statusFilter } : { status: { in: [...ADMIN_STATUSES] } },
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: {
      project: { select: { id: true, title: true } },
      requester: { select: { name: true, email: true } },
      reviewer: { select: { name: true, email: true } },
      scriptVersion: {
        select: {
          id: true,
          versionLabel: true,
          content: true,
          createdAt: true,
          script: { select: { title: true } },
        },
      },
      session: { select: { id: true, draftKey: true, reviewStatus: true } },
    },
  });

  const paid = requests.filter((r) => r.status !== "AWAITING_PAYMENT");
  const totalRevenue = paid.reduce((sum, r) => sum + (r.feeAmount || 0), 0);
  const completed = requests.filter((r) => r.status === "COMPLETED").length;
  const inReview = requests.filter((r) => r.status === "IN_REVIEW").length;
  const pending = requests.filter((r) => r.status === "PENDING_ADMIN_REVIEW").length;
  const needsRevision = requests.filter((r) => r.status === "NEEDS_REVISION").length;

  return NextResponse.json({
    summary: {
      totalRequests: requests.length,
      totalRevenue,
      completed,
      inReview,
      pending,
      needsRevision,
    },
    requests: requests.map((r) => ({
      ...r,
      scriptVersion: r.scriptVersion
        ? {
            ...r.scriptVersion,
            contentPreview: (r.scriptVersion.content ?? "").slice(0, 4000),
            contentLength: (r.scriptVersion.content ?? "").length,
          }
        : null,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const adminId = (session?.user as { id?: string })?.id;
  if (role !== "ADMIN" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        status?: string;
        feedbackUrl?: string | null;
        feedbackNotes?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.scriptReviewRequest.findUnique({
    where: { id: body.id },
    include: {
      requester: true,
      project: true,
      scriptVersion: { select: { id: true } },
      session: { select: { id: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const nextStatus = body.status ?? existing.status;

  const updated = await prisma.scriptReviewRequest.update({
    where: { id: body.id },
    data: {
      ...(body.status ? { status: body.status, reviewerId: adminId } : {}),
      ...(body.feedbackUrl !== undefined ? { feedbackUrl: body.feedbackUrl } : {}),
      ...(body.feedbackNotes !== undefined ? { feedbackNotes: body.feedbackNotes } : {}),
      ...(nextStatus === "COMPLETED" ? { reviewedAt: now } : {}),
    },
    include: {
      project: { select: { id: true, title: true } },
      scriptVersion: {
        select: { id: true, versionLabel: true, script: { select: { title: true } } },
      },
      session: { select: { id: true, draftKey: true } },
    },
  });

  if (body.status === "IN_REVIEW" && existing.scriptVersionId) {
    const draftKey = `project-version:${existing.scriptVersionId}`;
    await prisma.scriptReviewSession.upsert({
      where: { projectId_draftKey: { projectId: existing.projectId, draftKey } },
      create: {
        projectId: existing.projectId,
        draftKey,
        scriptVersionId: existing.scriptVersionId,
        reviewRequestId: existing.id,
        reviewStatus: "IN_REVIEW",
      },
      update: {
        reviewRequestId: existing.id,
        reviewStatus: "IN_REVIEW",
      },
    });
  }

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminId,
      action: "SCRIPT_REVIEW_UPDATE",
      entityType: "ScriptReviewRequest",
      entityId: updated.id,
      oldValue: {
        status: existing.status,
        feedbackUrl: existing.feedbackUrl,
        feedbackNotes: existing.feedbackNotes,
      },
      newValue: {
        status: updated.status,
        feedbackUrl: updated.feedbackUrl,
        feedbackNotes: updated.feedbackNotes,
      },
    },
  });

  const creatorUrl = `/creator/projects/${existing.projectId}/pre-production/script-review?executiveRequestId=${existing.id}`;

  if (nextStatus === "COMPLETED") {
    await prisma.notification.create({
      data: {
        userId: existing.requesterId,
        type: "SYSTEM_RELEASE",
        title: "Executive script review delivered",
        body: `Your executive script review for "${existing.project.title}" is ready. Open Script Review Studio to read feedback and download your coverage.`,
        metadata: JSON.stringify({
          projectId: existing.projectId,
          reviewRequestId: existing.id,
          url: creatorUrl,
        }),
      },
    });
  }

  if (nextStatus === "NEEDS_REVISION") {
    await prisma.notification.create({
      data: {
        userId: existing.requesterId,
        type: "CONTRACT_EVENT",
        title: "Script review — revision requested",
        body: `Story Time has returned notes on "${existing.project.title}". Revise your script and resubmit when ready.`,
        metadata: JSON.stringify({
          projectId: existing.projectId,
          reviewRequestId: existing.id,
          url: creatorUrl,
        }),
      },
    });
  }

  return NextResponse.json({ request: updated });
}
