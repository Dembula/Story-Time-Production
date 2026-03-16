import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

async function ensureCreatorAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

function createSlug() {
  return Math.random().toString(36).slice(2, 10);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureCreatorAccess(params.projectId);
  if (access.error) return access.error;

  let link = await prisma.projectWorkspaceLink.findUnique({
    where: { projectId: params.projectId },
  });

  if (!link) {
    const slug = createSlug();
    link = await prisma.projectWorkspaceLink.create({
      data: {
        projectId: params.projectId,
        slug,
      },
    });
  }

  return NextResponse.json({ link });
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await ensureCreatorAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        rotateSlug?: boolean;
      }
    | null;

  let link = await prisma.projectWorkspaceLink.findUnique({
    where: { projectId: params.projectId },
  });

  if (!link) {
    const slug = createSlug();
    link = await prisma.projectWorkspaceLink.create({
      data: {
        projectId: params.projectId,
        slug,
      },
    });
  } else if (body?.rotateSlug) {
    const slug = createSlug();
    link = await prisma.projectWorkspaceLink.update({
      where: { id: link.id },
      data: { slug },
    });
  }

  return NextResponse.json({ link });
}

