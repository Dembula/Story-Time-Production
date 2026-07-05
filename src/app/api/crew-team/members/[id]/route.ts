import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta, parseEmbeddedMeta, type CrewMarketMeta } from "@/lib/marketplace-profile-meta";
import { validateStorageUrlField } from "@/lib/storage-origin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const member = await prisma.crewTeamMember.findUnique({ where: { id }, include: { crewTeam: true } });
  if (!member || member.crewTeam.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();

  for (const [field, value] of [
    ["photoUrl", body.photoUrl !== undefined ? body.photoUrl : member.photoUrl],
  ] as const) {
    const error = validateStorageUrlField(value, field);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  const profile = (body.profile ?? {}) as Partial<CrewMarketMeta>;
  const hasProfilePatch = body.profile !== undefined || body.bio !== undefined;
  let bio = member.bio;
  if (hasProfilePatch) {
    const existing = parseEmbeddedMeta<CrewMarketMeta>(member.bio);
    const merged: Partial<CrewMarketMeta> = {
      ...existing.meta,
      ...profile,
      role: profile.role ?? body.role ?? member.role,
      department: profile.department ?? body.department ?? member.department,
      phone: profile.phone ?? body.phone ?? member.phone,
      contactEmail: profile.contactEmail ?? body.email ?? member.email,
    };
    if (body.portfolioUrl !== undefined) merged.portfolioUrl = body.portfolioUrl || null;
    if (body.reelUrl !== undefined) merged.reelUrl = body.reelUrl || null;
    const plainBio = body.bio !== undefined ? body.bio : existing.plain;
    bio = embedMeta(plainBio ?? null, merged);
  }

  const updated = await prisma.crewTeamMember.update({
    where: { id },
    data: {
      name: body.name ?? member.name,
      role: body.role ?? member.role,
      department: body.department !== undefined ? body.department : member.department,
      bio: hasProfilePatch ? bio : body.bio !== undefined ? body.bio : member.bio,
      skills: body.skills !== undefined ? body.skills : member.skills,
      pastWork: body.pastWork !== undefined ? body.pastWork : member.pastWork,
      photoUrl: body.photoUrl !== undefined ? body.photoUrl : member.photoUrl,
      email: body.email !== undefined ? body.email : member.email,
      phone: body.phone !== undefined ? body.phone : member.phone,
      sortOrder: body.sortOrder !== undefined ? body.sortOrder : member.sortOrder,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const member = await prisma.crewTeamMember.findUnique({ where: { id }, include: { crewTeam: true } });
  if (!member || member.crewTeam.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.crewTeamMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
