import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const role = (session.user as { role?: string })?.role;
  let creatorId = userId;
  if (role === "ADMIN") {
    const first = await prisma.user.findFirst({ where: { role: "CONTENT_CREATOR" } });
    creatorId = first?.id ?? userId;
  }
  const list = await prisma.creatorCrewRoster.findMany({
    where: { creatorId: creatorId! },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const creatorId = role === "ADMIN" ? (await prisma.user.findFirst({ where: { role: "CONTENT_CREATOR" } }))?.id ?? userId : userId;
  const body = await req.json();
  const entry = await prisma.creatorCrewRoster.create({
    data: {
      creatorId: creatorId!,
      name: body.name,
      role: body.role ?? null,
      department: body.department ?? null,
      contactEmail: body.contactEmail ?? null,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
      pastProjects: body.pastProjects ?? null,
    },
  });
  return NextResponse.json(entry);
}
