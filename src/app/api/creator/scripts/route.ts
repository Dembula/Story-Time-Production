import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ScriptType = "FEATURE" | "SHORT" | "EPISODE" | "OTHER";

async function ensureCreatorSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const search = req.nextUrl.searchParams;
  const projectIdParam = search.get("projectId");

  const where: {
    userId: string;
    projectId?: string | null;
  } = { userId: access.userId! };

  if (projectIdParam !== null) {
    where.projectId = projectIdParam || null;
  }

  const scripts = await prisma.creatorScript.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Optionally decorate with project titles when linked
  const projectIds = Array.from(
    new Set(scripts.map((s) => s.projectId).filter((id): id is string => !!id)),
  );

  let titlesById = new Map<string, string>();
  if (projectIds.length > 0) {
    const projects = await prisma.originalProject.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, title: true },
    });
    titlesById = new Map(projects.map((p) => [p.id, p.title]));
  }

  const enriched = scripts.map((s) => ({
    ...s,
    projectTitle: s.projectId ? titlesById.get(s.projectId) ?? "" : "",
  }));

  return NextResponse.json({ scripts: enriched });
}

export async function POST(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        type?: ScriptType;
        content?: string;
        projectId?: string | null;
      }
    | null;

  const projectId =
    body?.projectId === undefined
      ? null
      : body.projectId === null || body.projectId === ""
      ? null
      : body.projectId;

  const script = await prisma.creatorScript.create({
    data: {
      userId: access.userId!,
      projectId,
      title: body?.title?.trim() || "New script",
      type: body?.type ?? "FEATURE",
      content: body?.content ?? "",
    },
  });

  return NextResponse.json({ script }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        title?: string;
        type?: ScriptType;
        content?: string;
        projectId?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const projectId =
    body.projectId === undefined
      ? undefined
      : body.projectId === null || body.projectId === ""
      ? null
      : body.projectId;

  const data: {
    title?: string;
    type?: ScriptType;
    content?: string;
    projectId?: string | null;
  } = {};

  if (body.title !== undefined) data.title = body.title;
  if (body.type !== undefined) data.type = body.type;
  if (body.content !== undefined) data.content = body.content;
  if (projectId !== undefined) data.projectId = projectId;

  const updated = await prisma.creatorScript.updateMany({
    where: { id: body.id, userId: access.userId! },
    data,
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const script = await prisma.creatorScript.findUnique({ where: { id: body.id } });

  return NextResponse.json({ script });
}

