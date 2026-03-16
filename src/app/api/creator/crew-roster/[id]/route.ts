import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const role = (session.user as { role?: string })?.role;
  const { id } = await params;
  const existing = await prisma.creatorCrewRoster.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role !== "ADMIN" && existing.creatorId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const updated = await prisma.creatorCrewRoster.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      role: body.role !== undefined ? body.role : existing.role,
      department: body.department !== undefined ? body.department : existing.department,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail : existing.contactEmail,
      phone: body.phone !== undefined ? body.phone : existing.phone,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      pastProjects: body.pastProjects !== undefined ? body.pastProjects : existing.pastProjects,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const role = (session.user as { role?: string })?.role;
  const { id } = await params;
  const existing = await prisma.creatorCrewRoster.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role !== "ADMIN" && existing.creatorId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.creatorCrewRoster.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
