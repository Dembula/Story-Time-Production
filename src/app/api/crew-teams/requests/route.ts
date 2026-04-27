import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Creator: list crew requests this user has sent (for status + pay). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id!;
  const rows = await prisma.crewTeamRequest.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      crewTeam: { select: { id: true, companyName: true, tagline: true, userId: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;
  const body = await req.json();
  const crewTeamId = body.crewTeamId;
  if (!crewTeamId) return NextResponse.json({ error: "crewTeamId required" }, { status: 400 });
  const team = await prisma.crewTeam.findUnique({ where: { id: crewTeamId } });
  if (!team) return NextResponse.json({ error: "Crew team not found" }, { status: 404 });
  const request = await prisma.crewTeamRequest.create({
    data: {
      creatorId: userId!,
      crewTeamId,
      projectName: body.projectName ?? null,
      message: body.message ?? null,
      status: "PENDING",
    },
  });
  return NextResponse.json(request);
}
