import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCreditName } from "@/lib/credit-person-types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const normalized = q ? normalizeCreditName(q) : "";

  const people = await prisma.creditPerson.findMany({
    where: normalized
      ? {
          OR: [
            { normalizedName: { contains: normalized } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      displayName: true,
      normalizedName: true,
      userId: true,
      imageUrl: true,
      user: { select: { id: true, name: true, email: true, professionalName: true } },
      _count: { select: { crewMembers: true } },
    },
  });

  const unlinkedCrew = await prisma.crewMember.count({ where: { creditPersonId: null } });

  return NextResponse.json({
    people: people.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      normalizedName: p.normalizedName,
      userId: p.userId,
      imageUrl: p.imageUrl,
      creditCount: p._count.crewMembers,
      linkedUser: p.user
        ? {
            id: p.user.id,
            name: p.user.professionalName || p.user.name,
            email: p.user.email,
          }
        : null,
    })),
    unlinkedCrew,
  });
}
