import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR } from "@/lib/pricing";

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
      where: role === "ADMIN" ? { projectId } : { projectId, requesterId: userId },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: {
        project: { select: { title: true } },
        scriptVersion: {
          select: {
            id: true,
            versionLabel: true,
            createdAt: true,
            script: { select: { title: true } },
          },
        },
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

  const body = (await req.json().catch(() => null)) as { scriptVersionId?: string } | null;
  const providedScriptVersionId = body?.scriptVersionId?.trim() || null;
  let scriptVersionId = providedScriptVersionId;

  if (scriptVersionId) {
    const selectedVersion = await prisma.projectScriptVersion.findFirst({
      where: { id: scriptVersionId, script: { projectId } },
      select: { id: true },
    });
    if (!selectedVersion) {
      return NextResponse.json({ error: "Selected script does not belong to this project" }, { status: 400 });
    }
  } else {
    const latestScript = await prisma.projectScriptVersion.findFirst({
      where: { script: { projectId } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    scriptVersionId = latestScript?.id ?? null;
  }

  const openRequest = await prisma.scriptReviewRequest.findFirst({
    where: {
      projectId,
      requesterId: userId,
      status: { in: ["AWAITING_PAYMENT", "PENDING_ADMIN_REVIEW", "IN_REVIEW"] },
    },
    select: { id: true },
  });
  if (openRequest) {
    return NextResponse.json({ error: "You already have an open script review request for this project." }, { status: 409 });
  }

  const amount = EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR;

  const requestRecord = await prisma.scriptReviewRequest.create({
    data: {
      projectId,
      scriptVersionId,
      requesterId: userId,
      feeAmount: amount,
      status: "AWAITING_PAYMENT",
    },
  });

  try {
    const { checkout, paymentRecord } = await initializeCheckout({
      userId,
      email: session.user?.email,
      customerName: session.user?.name,
      amount,
      purpose: "SCRIPT_REVIEW",
      referenceType: "ScriptReviewRequest",
      referenceId: requestRecord.id,
      returnUrl: buildPaymentReturnUrl(
        `/creator/projects/${projectId}/pre-production/script-review`,
        "script_review",
      ),
      metadata: {
        projectId,
        projectTitle: project.title,
        scriptVersionId,
        reviewRequestId: requestRecord.id,
      },
    });

    await prisma.scriptReviewRequest.update({
      where: { id: requestRecord.id },
      data: { paymentId: paymentRecord.id },
    });

    return NextResponse.json({
      review: requestRecord,
      requiresPayment: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentRecordId: paymentRecord.id,
      feeAmount: amount,
    });
  } catch (error) {
    await prisma.scriptReviewRequest.delete({ where: { id: requestRecord.id } }).catch(() => {});
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
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

  const body = (await req.json().catch(() => null)) as { notesBody?: string } | null;

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
