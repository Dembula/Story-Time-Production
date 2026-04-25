import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta, parseEmbeddedMeta, type ActorMarketMeta } from "@/lib/marketplace-profile-meta";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const talent = await prisma.castingTalent.findUnique({ where: { id }, include: { castingAgency: true } });
  if (!talent || talent.castingAgency.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const currentMeta = parseEmbeddedMeta<ActorMarketMeta>(talent.bio).meta;
  const profile = body.profile ?? {};
  const updated = await prisma.castingTalent.update({
    where: { id },
    data: {
      name: body.name ?? talent.name,
      bio:
        body.bio !== undefined ||
        body.profile !== undefined
          ? embedMeta(body.bio ?? parseEmbeddedMeta<ActorMarketMeta>(talent.bio).plain, {
              location: profile.location ?? currentMeta?.location ?? null,
              languages: profile.languages ?? currentMeta?.languages ?? [],
              experienceLevel: profile.experienceLevel ?? currentMeta?.experienceLevel ?? null,
              dailyRate: profile.dailyRate ?? currentMeta?.dailyRate ?? null,
              projectRate: profile.projectRate ?? currentMeta?.projectRate ?? null,
              availability: profile.availability ?? currentMeta?.availability ?? null,
              contactVisibility: profile.contactVisibility ?? currentMeta?.contactVisibility ?? "PRIVATE",
            })
          : talent.bio,
      cvUrl: body.cvUrl !== undefined ? body.cvUrl : talent.cvUrl,
      headshotUrl: body.headshotUrl !== undefined ? body.headshotUrl : talent.headshotUrl,
      ageRange: body.ageRange !== undefined ? body.ageRange : talent.ageRange,
      ethnicity: body.ethnicity !== undefined ? body.ethnicity : talent.ethnicity,
      gender: body.gender !== undefined ? body.gender : talent.gender,
      skills: body.skills !== undefined ? body.skills : talent.skills,
      pastWork: body.pastWork !== undefined ? body.pastWork : talent.pastWork,
      reelUrl: body.reelUrl !== undefined ? body.reelUrl : talent.reelUrl,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail : talent.contactEmail,
      sortOrder: body.sortOrder !== undefined ? body.sortOrder : talent.sortOrder,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const talent = await prisma.castingTalent.findUnique({ where: { id }, include: { castingAgency: true } });
  if (!talent || talent.castingAgency.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.castingTalent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
