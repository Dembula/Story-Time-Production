import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureAccess(projectId: string) {
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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  let delivery = await prisma.finalDelivery.findUnique({
    where: { projectId },
    include: { masterAsset: true },
  });

  if (!delivery) {
    delivery = await prisma.finalDelivery.create({
      data: { projectId },
      include: { masterAsset: true },
    });
  }

  return NextResponse.json({ delivery });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        masterAssetId?: string | null;
        notes?: string | null;
        status?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let delivery = await prisma.finalDelivery.findUnique({
    where: { projectId },
  });

  if (!delivery) {
    delivery = await prisma.finalDelivery.create({
      data: {
        projectId,
        masterAssetId: body.masterAssetId ?? null,
        notes: body.notes ?? null,
        status: body.status ?? "PENDING",
      },
    });
  } else {
    delivery = await prisma.finalDelivery.update({
      where: { id: delivery.id },
      data: {
        ...(body.masterAssetId !== undefined ? { masterAssetId: body.masterAssetId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });
  }

  return NextResponse.json({ delivery });
}
