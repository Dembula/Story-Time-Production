import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  estimateCateringTotalForHeads,
  shapeCateringQuoteProfile,
} from "@/lib/catering-pricing";

interface Params {
  params: Promise<{ id: string }>;
}

/** Authenticated creators see per-head / min-order rates for quoting (not on public catalog list). */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.email || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const headCountRaw = req.nextUrl.searchParams.get("headCount");
  const headCount = headCountRaw ? Number.parseInt(headCountRaw, 10) : null;

  const company = await prisma.cateringCompany.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quoteProfile = shapeCateringQuoteProfile(company);
  const estimate =
    headCount && headCount > 0 ? estimateCateringTotalForHeads(company, headCount) : null;

  return NextResponse.json({
    ...quoteProfile,
    estimate: estimate
      ? {
          headCount,
          subtotal: estimate.subtotal,
          pricePerHead: estimate.pricePerHead,
          minOrder: estimate.minOrder,
        }
      : null,
  });
}
