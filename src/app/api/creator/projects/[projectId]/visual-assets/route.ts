import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { isVisualPlanningCategory } from "@/lib/visual-planning-categories";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const assets = await prisma.projectVisualAsset.findMany({
    where: { projectId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ assets });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        category: string;
        imageUrl: string;
        title?: string | null;
        caption?: string | null;
      }
    | null;

  if (!body?.category || !body.imageUrl?.trim()) {
    return NextResponse.json({ error: "category and imageUrl are required" }, { status: 400 });
  }

  if (!isVisualPlanningCategory(body.category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const url = body.imageUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "imageUrl must be an http(s) URL" }, { status: 400 });
  }

  const agg = await prisma.projectVisualAsset.aggregate({
    where: { projectId, category: body.category },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;

  const asset = await prisma.projectVisualAsset.create({
    data: {
      projectId,
      category: body.category,
      imageUrl: url,
      title: body.title?.trim() || null,
      caption: body.caption?.trim() || null,
      sortOrder,
    },
  });

  return NextResponse.json({ asset }, { status: 201 });
}
