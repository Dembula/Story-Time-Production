import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateStorageUrlField } from "@/lib/storage-origin";
import { ensureCloudflareStreamPlaybackUrl, extractCloudflareStreamUid } from "@/lib/cloudflare-stream";
import { setStreamAssetEntity } from "@/lib/stream-asset-store";

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
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  const assets = await prisma.footageAsset.findMany({
    where: {
      projectId,
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assets });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        sceneId?: string;
        type: string;
        label?: string;
        fileUrl: string;
        metadata?: string;
      }
    | null;

  if (!body?.type || !body?.fileUrl) {
    return NextResponse.json({ error: "Missing type or fileUrl" }, { status: 400 });
  }
  const normalizedFileUrl = await ensureCloudflareStreamPlaybackUrl(body.fileUrl, {
    area: "footage",
    projectId,
  });
  const fileErr = validateStorageUrlField(normalizedFileUrl, "fileUrl", { allowNull: false });
  if (fileErr) return NextResponse.json({ error: fileErr }, { status: 400 });
  const finalFileUrl = normalizedFileUrl ?? body.fileUrl;

  const asset = await prisma.footageAsset.create({
    data: {
      projectId,
      sceneId: body.sceneId ?? null,
      type: body.type,
      label: body.label ?? null,
      fileUrl: finalFileUrl,
      metadata: body.metadata ?? null,
    },
  });
  const uid = extractCloudflareStreamUid(finalFileUrl);
  if (uid) await setStreamAssetEntity(uid, "FootageAsset", asset.id);

  return NextResponse.json({ asset }, { status: 201 });
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
        id: string;
        sceneId?: string | null;
        label?: string | null;
        type?: string;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.footageAsset.findFirst({
    where: { id: body.id, projectId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.sceneId) {
    const sc = await prisma.projectScene.findFirst({
      where: { id: body.sceneId, projectId },
    });
    if (!sc) {
      return NextResponse.json({ error: "Invalid sceneId" }, { status: 400 });
    }
  }

  const asset = await prisma.footageAsset.update({
    where: { id: body.id },
    data: {
      ...(body.sceneId !== undefined ? { sceneId: body.sceneId } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
    },
  });

  return NextResponse.json({ asset });
}
