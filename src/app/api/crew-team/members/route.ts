import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta, type CrewMarketMeta } from "@/lib/marketplace-profile-meta";
import { validateStorageUrlField } from "@/lib/storage-origin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const team = await prisma.crewTeam.findUnique({ where: { userId: userId! }, include: { members: { orderBy: { sortOrder: "asc" } } } });
  if (!team) return NextResponse.json([]);
  return NextResponse.json(team.members);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const team = await prisma.crewTeam.findUnique({ where: { userId: userId! } });
  if (!team) return NextResponse.json({ error: "Create team profile first" }, { status: 400 });
  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const photoErr = validateStorageUrlField(body.photoUrl, "photoUrl");
  if (photoErr) return NextResponse.json({ error: photoErr }, { status: 400 });
  const profile = (body.profile ?? {}) as Partial<CrewMarketMeta>;
  const member = await prisma.crewTeamMember.create({
    data: {
      crewTeamId: team.id,
      name: body.name.trim(),
      role: body.role || "Crew",
      department: body.department || null,
      bio: embedMeta(body.bio ?? null, {
        role: profile.role ?? body.role ?? null,
        department: profile.department ?? body.department ?? null,
        dailyRate: profile.dailyRate ?? null,
        availability: profile.availability ?? null,
        location: profile.location ?? null,
        experienceLevel: profile.experienceLevel ?? null,
        tools: profile.tools ?? [],
      }),
      skills: body.skills || null,
      pastWork: body.pastWork || null,
      photoUrl: body.photoUrl || null,
      email: body.email || null,
      phone: body.phone || null,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json(member);
}
