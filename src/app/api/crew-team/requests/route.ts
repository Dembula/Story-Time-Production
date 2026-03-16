import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const team = await prisma.crewTeam.findUnique({ where: { userId: userId! } });
  if (!team) return NextResponse.json([]);
  const requests = await prisma.crewTeamRequest.findMany({
    where: { crewTeamId: team.id },
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(requests);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  const team = await prisma.crewTeam.findUnique({ where: { userId: userId! } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  const body = await req.json();
  const requestId = body.requestId;
  const status = body.status; // ACCEPTED | DECLINED
  if (!requestId || !status) return NextResponse.json({ error: "requestId and status required" }, { status: 400 });
  const reqEntry = await prisma.crewTeamRequest.findFirst({ where: { id: requestId, crewTeamId: team.id } });
  if (!reqEntry) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  const updated = await prisma.crewTeamRequest.update({
    where: { id: requestId },
    data: { status },
  });
  return NextResponse.json(updated);
}
