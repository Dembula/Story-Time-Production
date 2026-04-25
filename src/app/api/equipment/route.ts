import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFeaturedCompanyPlan } from "@/lib/pricing";
import { parseEmbeddedMeta, embedMeta, type EquipmentMarketMeta } from "@/lib/marketplace-profile-meta";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const category = req.nextUrl.searchParams.get("category");
  const specs = req.nextUrl.searchParams.get("specifications");
  const availability = req.nextUrl.searchParams.get("availability");
  const minCost = Number(req.nextUrl.searchParams.get("minCost") ?? "");
  const maxCost = Number(req.nextUrl.searchParams.get("maxCost") ?? "");
  const where: { companyId?: string; category?: { contains: string; mode: "insensitive" } } = {};
  if (companyId) where.companyId = companyId;
  if (category) where.category = { contains: category, mode: "insensitive" };
  const now = new Date();

  const equipment = await prisma.equipmentListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          companySubscriptions: {
            where: { companyType: "EQUIPMENT_COMPANY", status: "ACTIVE", currentPeriodEnd: { gt: now } },
            take: 1,
            select: { plan: true },
          },
        },
      },
    },
  });
  const sorted = [...equipment].sort((a, b) => {
    const promotedA = isFeaturedCompanyPlan((a.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    const promotedB = isFeaturedCompanyPlan((b.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    return promotedA - promotedB || (a.companyName || "").localeCompare(b.companyName || "");
  });
  const shaped = sorted
    .map((row) => {
      const parsed = parseEmbeddedMeta<EquipmentMarketMeta>(row.description);
      const dailyRate = parsed.meta?.dailyRate ?? null;
      const passMin = Number.isFinite(minCost) ? (dailyRate ?? 0) >= minCost : true;
      const passMax = Number.isFinite(maxCost) ? (dailyRate ?? 0) <= maxCost : true;
      if (!passMin || !passMax) return null;
      if (availability && !(parsed.meta?.availability ?? "").toLowerCase().includes(availability.toLowerCase())) return null;
      if (specs && !(parsed.meta?.specifications ?? "").toLowerCase().includes(specs.toLowerCase())) return null;
      return {
        ...row,
        profile: {
          name: parsed.plain || row.companyName,
          category: row.category,
          specifications: parsed.meta?.specifications ?? null,
          dailyRate,
          quantityAvailable: parsed.meta?.quantityAvailable ?? null,
          availability: parsed.meta?.availability ?? null,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return NextResponse.json(shaped);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id!;

  if (role !== "EQUIPMENT_COMPANY" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const profile = body.profile ?? {};
  const listing = await prisma.equipmentListing.create({
    data: {
      companyName: body.companyName,
      description: embedMeta(body.description || null, {
        specifications: profile.specifications ?? null,
        dailyRate: profile.dailyRate ?? null,
        quantityAvailable: profile.quantityAvailable ?? null,
        availability: profile.availability ?? null,
      }),
      category: body.category,
      imageUrl: body.imageUrl || null,
      contactUrl: body.contactUrl || null,
      location: body.location || null,
      companyId: userId,
    },
  });
  return NextResponse.json(listing);
}
