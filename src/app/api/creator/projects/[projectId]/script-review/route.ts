import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndConfirmPayment } from "@/lib/payments";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [note, requests] = await Promise.all([
    prisma.scriptReviewNote.findFirst({
      where: { userId, projectId },
    }),
    prisma.scriptReviewRequest.findMany({
      where:
        role === "ADMIN"
          ? { projectId }
          : { projectId, requesterId: userId },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: {
        project: { select: { title: true } },
        requester: { select: { name: true, email: true } },
        reviewer: { select: { name: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    notes: note ?? { body: "" },
    requests,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const latestScript = await prisma.projectScriptVersion.findFirst({
    where: { script: { projectId } },
    orderBy: { createdAt: "desc" },
  });

  const amount = 599.99;

  const payment = await createAndConfirmPayment({
    amount,
    currency: "ZAR",
    metadata: {
      kind: "SCRIPT_REVIEW",
      projectId,
      requesterId: userId,
    },
  });

  if (!payment.success) {
    return NextResponse.json(
      { error: payment.error ?? "Payment failed" },
      { status: 400 }
    );
  }

  const requestRecord = await prisma.scriptReviewRequest.create({
    data: {
      projectId,
      scriptVersionId: latestScript?.id ?? null,
      requesterId: userId,
      feeAmount: amount,
      paymentId: payment.id,
      status: "PENDING_ADMIN_REVIEW",
    },
  });

  await prisma.notification.create({
    data: {
      userId, // could be routed to admins; for now notify requester
      type: "CONTRACT_EVENT",
      title: "Executive script review requested",
      body: `Your script for "${project.title}" has been submitted for Story Time Executive Script Review.`,
      metadata: JSON.stringify({
        projectId,
        reviewRequestId: requestRecord.id,
      }),
    },
  });

  return NextResponse.json({ review: requestRecord });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        notesBody?: string;
      }
    | null;

  if (!body?.notesBody && body?.notesBody !== "") {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const note = await prisma.scriptReviewNote.upsert({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    create: {
      userId,
      projectId,
      body: body.notesBody ?? "",
    },
    update: {
      body: body.notesBody ?? "",
    },
  });

  return NextResponse.json({ notes: note });
}

