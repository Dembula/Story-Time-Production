import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;
  const member = await prisma.crewTeamMember.findUnique({ where: { id }, include: { crewTeam: true } });
  if (!member || member.crewTeam.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.crewTeamMember.update({
    where: { id },
    data: {
      name: body.name ?? member.name,
      role: body.role ?? member.role,
      department: body.department !== undefined ? body.department : member.department,
      bio: body.bio !== undefined ? body.bio : member.bio,
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
