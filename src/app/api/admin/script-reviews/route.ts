import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.scriptReviewRequest.findMany({
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: {
      project: { select: { title: true } },
      requester: { select: { name: true, email: true } },
      reviewer: { select: { name: true, email: true } },
    },
  });

  const totalRevenue = requests.reduce((sum, r) => sum + (r.feeAmount || 0), 0);
  const completed = requests.filter((r) => r.status === "COMPLETED").length;
  const inReview = requests.filter((r) => r.status === "IN_REVIEW").length;
  const pending = requests.filter((r) => r.status === "PENDING_ADMIN_REVIEW").length;

  return NextResponse.json({
    summary: {
      totalRequests: requests.length,
      totalRevenue,
      completed,
      inReview,
      pending,
    },
    requests,
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
    include: { requester: true, project: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  const updated = await prisma.scriptReviewRequest.update({
    where: { id: body.id },
    data: {
      ...(body.status ? { status: body.status, reviewerId: adminId } : {}),
      ...(body.feedbackUrl !== undefined ? { feedbackUrl: body.feedbackUrl } : {}),
      ...(body.feedbackNotes !== undefined ? { feedbackNotes: body.feedbackNotes } : {}),
      ...(body.status === "COMPLETED" ? { reviewedAt: now } : {}),
    },
  });

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

  if (body.status === "COMPLETED") {
    await prisma.notification.create({
      data: {
        userId: existing.requesterId,
        type: "SYSTEM_RELEASE",
        title: "Script review completed",
        body: `Your executive script review for "${existing.project.title}" is ready.`,
        metadata: JSON.stringify({
          projectId: existing.projectId,
          reviewRequestId: existing.id,
        }),
      },
    });
  }

  return NextResponse.json({ request: updated });
}

