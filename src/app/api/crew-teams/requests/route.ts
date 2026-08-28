import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyCrewRequestCreated } from "@/lib/marketplace-notifications";
import { buildMarketplaceBookingNote } from "@/lib/marketplace-booking-context";

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
  const team = await prisma.crewTeam.findUnique({
    where: { id: crewTeamId },
    select: { id: true, companyName: true, userId: true },
  });
  if (!team) return NextResponse.json({ error: "Crew team not found" }, { status: 404 });
  const creator = await prisma.user.findUnique({ where: { id: userId! }, select: { name: true } });

  let projectTitle = typeof body.projectName === "string" ? body.projectName : null;
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (projectId) {
    const project = await prisma.originalProject.findFirst({
      where: { id: projectId, pitches: { some: { creatorId: userId! } } },
      select: { id: true, title: true },
    });
    if (project) projectTitle = project.title;
  }

  const request = await prisma.crewTeamRequest.create({
    data: {
      creatorId: userId!,
      crewTeamId,
      projectName: projectTitle,
      message: buildMarketplaceBookingNote(body.message ?? null, {
        projectId,
        projectTitle,
      }),
      status: "PENDING",
    },
  });
  try {
    await notifyCrewRequestCreated({
      teamUserId: team.userId,
      creatorName: creator?.name,
      teamName: team.companyName,
      requestId: request.id,
    });
  } catch {
    /* non-blocking */
  }
  return NextResponse.json(request);
}
