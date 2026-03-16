import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agency = await prisma.castingAgency.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      talent: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!agency) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agency);
}
