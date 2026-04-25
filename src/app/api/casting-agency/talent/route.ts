import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta } from "@/lib/marketplace-profile-meta";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! }, include: { talent: { orderBy: { sortOrder: "asc" } } } });
  if (!agency) return NextResponse.json([]);
  return NextResponse.json(agency.talent);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! } });
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 400 });
  const body = await req.json();
  const profile = body.profile ?? {};
  const talent = await prisma.castingTalent.create({
    data: {
      castingAgencyId: agency.id,
      name: body.name,
      bio: embedMeta(body.bio ?? null, {
        location: profile.location ?? null,
        languages: profile.languages ?? [],
        experienceLevel: profile.experienceLevel ?? null,
        dailyRate: profile.dailyRate ?? null,
        projectRate: profile.projectRate ?? null,
        availability: profile.availability ?? null,
        contactVisibility: profile.contactVisibility ?? "PRIVATE",
      }),
      cvUrl: body.cvUrl ?? null,
      headshotUrl: body.headshotUrl ?? null,
      ageRange: body.ageRange ?? null,
      ethnicity: body.ethnicity ?? null,
      gender: body.gender ?? null,
      skills: body.skills ?? null,
      pastWork: body.pastWork ?? null,
      reelUrl: body.reelUrl ?? null,
      contactEmail: body.contactEmail ?? null,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json(talent);
}
