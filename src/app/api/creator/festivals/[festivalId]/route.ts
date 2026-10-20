import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  feeForTier,
  festivalAcceptsSubmissions,
  resolveDeadlineTier,
} from "@/lib/festival/constants";

type Ctx = { params: Promise<{ festivalId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { festivalId } = await ctx.params;
  const festival = await prisma.festival.findFirst({
    where: {
      OR: [{ id: festivalId }, { slug: festivalId }],
      status: { in: ["LIVE", "SUBMISSIONS_CLOSED", "ENDED"] },
    },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      mediaAssets: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!festival) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tier = resolveDeadlineTier(festival);
  const categories = festival.categories.map((c) => ({
    ...c,
    currentFeeZar: feeForTier(c, tier),
  }));

  return NextResponse.json({
    festival: {
      ...festival,
      categories,
      acceptingSubmissions: festivalAcceptsSubmissions(festival),
      currentTier: tier,
    },
  });
}
