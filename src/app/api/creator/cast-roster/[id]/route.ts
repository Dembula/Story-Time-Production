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
  const existing = await prisma.creatorCastRoster.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role !== "ADMIN" && existing.creatorId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const updated = await prisma.creatorCastRoster.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      roleType: body.roleType !== undefined ? body.roleType : existing.roleType,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail : existing.contactEmail,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      pastWork: body.pastWork !== undefined ? body.pastWork : existing.pastWork,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const role = (session.user as { role?: string })?.role;
  const { id } = await params;
  const existing = await prisma.creatorCastRoster.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role !== "ADMIN" && existing.creatorId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.creatorCastRoster.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
