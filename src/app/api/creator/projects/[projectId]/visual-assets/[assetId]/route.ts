import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "../../../../../../../../generated/prisma";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { isVisualPlanningCategory } from "@/lib/visual-planning-categories";

interface Params {
  params: Promise<{ projectId: string; assetId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, assetId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const existing = await prisma.projectVisualAsset.findFirst({
    where: { id: assetId, projectId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string | null;
        caption?: string | null;
        category?: string;
        sortOrder?: number;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: Prisma.ProjectVisualAssetUpdateInput = {};
  if ("title" in body) data.title = body.title?.trim() || null;
  if ("caption" in body) data.caption = body.caption?.trim() || null;
  if ("sortOrder" in body && typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.floor(body.sortOrder);
  }
  if (body.category !== undefined) {
    if (!isVisualPlanningCategory(body.category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    data.category = body.category;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const asset = await prisma.projectVisualAsset.update({
    where: { id: assetId },
    data,
  });

  return NextResponse.json({ asset });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId, assetId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const existing = await prisma.projectVisualAsset.findFirst({
    where: { id: assetId, projectId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  await prisma.projectVisualAsset.delete({ where: { id: assetId } });
  return NextResponse.json({ ok: true });
}
