import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {

  ensureReviewProjectAccess,

  ensureReviewProjectAccessForExecutive,

  reviewAccessDenied,

} from "@/lib/script-review/access";



type RouteParams = { params: Promise<{ projectId: string }> };



export async function GET(req: NextRequest, { params }: RouteParams) {

  const { projectId } = await params;

  const draftKey = req.nextUrl.searchParams.get("draftKey");

  const executiveRequestId = req.nextUrl.searchParams.get("executiveRequestId");

  const gate = await ensureReviewProjectAccessForExecutive(projectId, executiveRequestId);

  if (gate.error) return gate.error;

  if (!draftKey) {

    return NextResponse.json({ error: "draftKey required" }, { status: 400 });

  }



  let session = await prisma.scriptReviewSession.findUnique({

    where: { projectId_draftKey: { projectId, draftKey } },

    include: {

      annotations: {

        where: { parentId: null },

        include: {

          author: {

            select: { id: true, name: true, professionalName: true, image: true },

          },

          replies: {

            include: {

              author: {

                select: { id: true, name: true, professionalName: true, image: true },

              },

            },

            orderBy: { createdAt: "asc" },

          },

        },

        orderBy: { createdAt: "asc" },

      },

    },

  });



  if (!session) {

    const creatorScriptId = draftKey.startsWith("creator-script:")

      ? draftKey.replace("creator-script:", "")

      : null;

    const scriptVersionId = draftKey.startsWith("project-version:")

      ? draftKey.replace("project-version:", "")

      : null;



    session = await prisma.scriptReviewSession.create({

      data: {

        projectId,

        draftKey,

        creatorScriptId,

        scriptVersionId,

        reviewRequestId: executiveRequestId ?? undefined,

        reviewStatus: executiveRequestId ? "PENDING_REVIEW" : "IN_REVIEW",

      },

      include: {

        annotations: {

          include: {

            author: {

              select: { id: true, name: true, professionalName: true, image: true },

            },

            replies: {

              include: {

                author: {

                  select: { id: true, name: true, professionalName: true, image: true },

                },

              },

            },

          },

        },

      },

    });

  }



  return NextResponse.json({

    session,

    permissions: gate.access!.permissions,

  });

}



export async function PATCH(req: NextRequest, { params }: RouteParams) {

  const { projectId } = await params;

  const gate = await ensureReviewProjectAccess(projectId);

  if (reviewAccessDenied(gate)) return gate.error;



  const body = (await req.json().catch(() => null)) as {

    sessionId?: string;

    reviewStatus?: string;

    coverageReport?: string;

  } | null;



  if (!body?.sessionId) {

    return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  }



  if (body.reviewStatus && !gate.access.permissions.canEditStatus) {

    return NextResponse.json({ error: "Cannot edit review status" }, { status: 403 });

  }



  const session = await prisma.scriptReviewSession.update({

    where: { id: body.sessionId, projectId },

    data: {

      ...(body.reviewStatus ? { reviewStatus: body.reviewStatus } : {}),

      ...(body.coverageReport !== undefined ? { coverageReport: body.coverageReport } : {}),

    },

  });



  return NextResponse.json({ session });

}


