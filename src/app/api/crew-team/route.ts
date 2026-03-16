import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CREW_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;
  const team = await prisma.crewTeam.findUnique({
    where: { userId: userId! },
    include: { members: { orderBy: { sortOrder: "asc" } }, _count: { select: { requests: true } } },
  });
  return NextResponse.json(team);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CREW_TEAM" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;
  const body = await req.json();
  const existing = await prisma.crewTeam.findUnique({ where: { userId: userId! } });
  if (existing) return NextResponse.json({ error: "Profile already exists" }, { status: 400 });
  const team = await prisma.crewTeam.create({
    data: {
      userId: userId!,
      companyName: body.companyName ?? "My Crew Team",
      tagline: body.tagline ?? null,
      description: body.description ?? null,
      location: body.location ?? null,
      city: body.city ?? null,
      province: body.province ?? null,
      country: body.country ?? null,
      specializations: body.specializations ?? null,
      website: body.website ?? null,
      contactEmail: body.contactEmail ?? null,
      logoUrl: body.logoUrl ?? null,
      pastWorkSummary: body.pastWorkSummary ?? null,
    },
    include: { members: true },
  });
  return NextResponse.json(team);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const team = await prisma.crewTeam.findUnique({ where: { userId: userId! } });
  if (!team) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  const body = await req.json();
  const updated = await prisma.crewTeam.update({
    where: { id: team.id },
    data: {
      companyName: body.companyName ?? team.companyName,
      tagline: body.tagline !== undefined ? body.tagline : team.tagline,
      description: body.description !== undefined ? body.description : team.description,
      location: body.location !== undefined ? body.location : team.location,
      city: body.city !== undefined ? body.city : team.city,
      province: body.province !== undefined ? body.province : team.province,
      country: body.country !== undefined ? body.country : team.country,
      specializations: body.specializations !== undefined ? body.specializations : team.specializations,
      website: body.website !== undefined ? body.website : team.website,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail : team.contactEmail,
      logoUrl: body.logoUrl !== undefined ? body.logoUrl : team.logoUrl,
      pastWorkSummary: body.pastWorkSummary !== undefined ? body.pastWorkSummary : team.pastWorkSummary,
    },
    include: { members: true },
  });
  return NextResponse.json(updated);
}
