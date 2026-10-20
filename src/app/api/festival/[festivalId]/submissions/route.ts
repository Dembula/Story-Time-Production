import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canStage1Review,
  canStage2Review,
  requireFestivalAccess,
  requireFestivalSession,
} from "@/lib/festival/access";

type Ctx = { params: Promise<{ festivalId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canStage1Review(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stage = req.nextUrl.searchParams.get("stage");
  const selection = req.nextUrl.searchParams.get("selection");
  const group = req.nextUrl.searchParams.get("group");

  const where: Record<string, unknown> = {
    festivalId,
    paymentStatus: "PAID",
  };
  if (stage === "STAGE1" || stage === "STAGE2") where.reviewStage = stage;
  if (selection) where.selectionStatus = selection;
  if (group === "A" || group === "B" || group === "C") where.stage1Group = group;

  // Stage 2 reviewers only see escalated titles unless they can also manage
  if (
    access.membershipRole === "STAGE2_REVIEWER" &&
    !canStage1Review(access.membershipRole, false)
  ) {
    // STAGE2_REVIEWER is included in canStage1Review — keep stage2 filter optional
  }
  if (access.membershipRole === "STAGE2_REVIEWER" && stage !== "STAGE1") {
    where.reviewStage = "STAGE2";
  }

  const submissions = await prisma.festivalSubmission.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    include: {
      category: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
      stage1Reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
      },
      stage2Reviews: {
        include: { reviewer: { select: { id: true, name: true, email: true } } },
      },
    },
    take: 200,
  });

  return NextResponse.json({
    submissions,
    membershipRole: access.membershipRole,
    canStage2: canStage2Review(access.membershipRole, auth.role === "ADMIN"),
  });
}
