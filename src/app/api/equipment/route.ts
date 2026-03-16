import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const where = companyId ? { companyId } : {};

  const equipment = await prisma.equipmentListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          companySubscriptions: { where: { companyType: "EQUIPMENT_COMPANY", status: "ACTIVE" }, take: 1, select: { plan: true } },
        },
      },
    },
  });
  const sorted = [...equipment].sort((a, b) => {
    const promotedA = (a.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan === "PROMOTED_R49" ? 0 : 1;
    const promotedB = (b.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan === "PROMOTED_R49" ? 0 : 1;
    return promotedA - promotedB || (a.companyName || "").localeCompare(b.companyName || "");
  });
  return NextResponse.json(sorted);
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
  const listing = await prisma.equipmentListing.create({
    data: {
      companyName: body.companyName,
      description: body.description || null,
      category: body.category,
      imageUrl: body.imageUrl || null,
      contactUrl: body.contactUrl || null,
      location: body.location || null,
      companyId: userId,
    },
  });
  return NextResponse.json(listing);
}
