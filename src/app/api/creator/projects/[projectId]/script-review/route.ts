import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndConfirmPayment } from "@/lib/payments";
import {
  getScriptReviewNotes,
  upsertScriptReviewNotes,
} from "@/lib/scriptReviewStore";

interface Params {
  params: { projectId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notes, requests] = await Promise.all([
    getScriptReviewNotes({ userId, projectId: params.projectId }),
    prisma.scriptReviewRequest.findMany({
      where:
        role === "ADMIN"
          ? { projectId: params.projectId }
          : { projectId: params.projectId, requesterId: userId },
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
    notes: notes ?? { body: "" },
    requests,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: params.projectId },
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
    where: { script: { projectId: params.projectId } },
    orderBy: { createdAt: "desc" },
  });

  const amount = 599.99;

  const payment = await createAndConfirmPayment({
    amount,
    currency: "ZAR",
    metadata: {
      kind: "SCRIPT_REVIEW",
      projectId: params.projectId,
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
      projectId: params.projectId,
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
        projectId: params.projectId,
        reviewRequestId: requestRecord.id,
      }),
    },
  });

  return NextResponse.json({ review: requestRecord });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const record = await upsertScriptReviewNotes({
    userId,
    projectId: params.projectId,
    body: body.notesBody ?? "",
  });

  return NextResponse.json({ notes: record });
}

