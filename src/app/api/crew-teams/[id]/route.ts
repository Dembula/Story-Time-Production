import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCrewMemberProfile } from "@/lib/company-marketplace-profiles";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await prisma.crewTeam.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      members: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...team,
    members: team.members.map((m) => ({
      ...m,
      profile: parseCrewMemberProfile(m),
      plainBio: parseCrewMemberProfile(m).plainBio,
      previewImageUrl: m.photoUrl,
    })),
  });
}
