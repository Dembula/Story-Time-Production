import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shapeCateringListingForPublicCatalog } from "@/lib/catering-pricing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.cateringCompany.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { bookings: true } },
    },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(shapeCateringListingForPublicCatalog(company));
}
