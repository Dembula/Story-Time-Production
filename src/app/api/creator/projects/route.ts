import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countIdeasByProjectForUser } from "@/lib/ideaStore";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN") || !userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.originalProject.findMany({
    where: {
      OR: [
        { pitches: { some: { creatorId: userId } } },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: true,
      pitches: {
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const ideaCountByProject = await countIdeasByProjectForUser(userId);

  const withActivity = projects.map((p) => {
    const latestPitch = p.pitches[0];
    const isOriginal = !!latestPitch && latestPitch.status !== "DRAFT";

    return {
      ...p,
      projectToolProgress: [],
      ideasCount: ideaCountByProject.get(p.id) ?? 0,
      isOriginal,
    };
  });

  // Sort: projects with activity (ideas or tool progress) first, then by updatedAt
  const sorted = [...withActivity].sort((a, b) => {
    const aActivity = (a.ideasCount ?? 0) + (a.projectToolProgress?.length ?? 0);
    const bActivity = (b.ideasCount ?? 0) + (b.projectToolProgress?.length ?? 0);
    if (bActivity !== aActivity) return bActivity - aActivity;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return NextResponse.json({ projects: sorted });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN") || !userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    type?: string;
    logline?: string;
    genre?: string;
    isOriginal?: boolean;
    isCollaboration?: boolean;
    collaboratorIds?: string[];
  } | null;

  if (!body?.title || !body?.type) {
    return NextResponse.json({ error: "Missing title or type" }, { status: 400 });
  }

  const project = await prisma.originalProject.create({
    data: {
      title: body.title,
      type: body.type,
      logline: body.logline,
      genre: body.genre,
      status: "DEVELOPMENT",
      phase: "CONCEPT",
      pitches: {
        create: {
          title: body.title,
          type: body.type,
          logline: body.logline,
          genre: body.genre,
          creatorId: userId,
          status: body.isOriginal ? "SUBMITTED" : "DRAFT",
        },
      },
      members: {
        create: [
          {
            userId,
            role: body.isCollaboration ? "Lead Creator" : "Creator",
            department: "Producing",
            status: "ACCEPTED",
          },
          ...(Array.isArray(body.collaboratorIds)
            ? body.collaboratorIds.map((cid) => ({
                userId: cid,
                role: "Collaborator",
                department: "Producing",
                status: "INVITED",
              }))
            : []),
        ],
      },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}

