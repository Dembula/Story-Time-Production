import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const talent = await prisma.castingTalent.findUnique({ where: { id }, include: { castingAgency: true } });
  if (!talent || talent.castingAgency.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.castingTalent.update({
    where: { id },
    data: {
      name: body.name ?? talent.name,
      bio: body.bio !== undefined ? body.bio : talent.bio,
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
