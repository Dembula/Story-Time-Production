import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createScriptForUser,
  listScriptsForUser,
  updateScriptForUser,
  ScriptType,
} from "@/lib/scriptStore";
import { prisma } from "@/lib/prisma";

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

  const scripts = await listScriptsForUser({
    userId: access.userId!,
    projectId: projectIdParam === null ? undefined : projectIdParam || null,
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

  const script = await createScriptForUser({
    userId: access.userId!,
    projectId,
    title: body?.title,
    type: body?.type,
    content: body?.content,
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

  const updated = await updateScriptForUser({
    userId: access.userId!,
    id: body.id,
    projectId,
    title: body.title,
    type: body.type,
    content: body.content,
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ script: updated });
}

