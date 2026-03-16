import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

async function ensureCastingAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { error: null as NextResponse | null };
}

export async function POST(_req: NextRequest, { params }: Params) {
  const access = await ensureCastingAccess(params.projectId);
  if (access.error) return access.error;

  const characters = await prisma.breakdownCharacter.findMany({
    where: { projectId: params.projectId },
  });

  if (characters.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 }, { status: 200 });
  }

  const existingRoles = await prisma.castingRole.findMany({
    where: { projectId: params.projectId },
    select: { id: true, name: true, breakdownCharacterId: true },
  });

  const existingByCharacterId = new Set(
    existingRoles.map((r) => r.breakdownCharacterId).filter((id): id is string => !!id)
  );

  const existingByName = new Set(existingRoles.map((r) => r.name.toLowerCase()));

  let createdCount = 0;
  let skippedCount = 0;

  for (const ch of characters) {
    const id = ch.id as string | undefined;
    const name = ch.name?.trim();
    if (!name) {
      skippedCount++;
      continue;
    }

    if ((id && existingByCharacterId.has(id)) || existingByName.has(name.toLowerCase())) {
      skippedCount++;
      continue;
    }

    await prisma.castingRole.create({
      data: {
        projectId: params.projectId,
        name,
        description: ch.description ?? null,
        breakdownCharacterId: id ?? null,
      },
    });
    createdCount++;
  }

  return NextResponse.json({ created: createdCount, skipped: skippedCount }, { status: 201 });
}

