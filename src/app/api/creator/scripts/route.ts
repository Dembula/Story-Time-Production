import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { ensureScriptAccess } from "@/lib/script-studio/collaboration-access";

type ScriptType = "FEATURE" | "SHORT" | "EPISODE" | "OTHER";

async function ensureCreatorSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
      isAdmin: false,
    };
  }

  return { error: null as NextResponse | null, userId, isAdmin: role === "ADMIN" };
}

export async function GET(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const search = req.nextUrl.searchParams;
  const projectIdParam = search.get("projectId");

  if (projectIdParam) {
    const gate = await ensureProjectAccess(projectIdParam);
    if (gate.error) return gate.error;

    const scripts = await prisma.creatorScript.findMany({
      where: { projectId: projectIdParam },
      orderBy: { updatedAt: "desc" },
    });

    const projects = await prisma.originalProject.findUnique({
      where: { id: projectIdParam },
      select: { id: true, title: true },
    });

    const enriched = scripts.map((s) => ({
      ...s,
      projectTitle: projects?.title ?? "",
    }));

    return NextResponse.json({ scripts: enriched });
  }

  const scripts = await prisma.creatorScript.findMany({
    where: { userId: access.userId!, projectId: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ scripts: enrichedStandalone(scripts) });
}

function enrichedStandalone(
  scripts: Array<{ projectId: string | null } & Record<string, unknown>>,
) {
  return scripts.map((s) => ({
    ...s,
    projectTitle: "",
  }));
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

  if (projectId) {
    const gate = await ensureProjectAccess(projectId);
    if (gate.error) return gate.error;
  }

  const script = await prisma.creatorScript.create({
    data: {
      userId: access.userId!,
      projectId,
      title: body?.title?.trim() || "New script",
      type: body?.type ?? "FEATURE",
      content: body?.content ?? "",
    },
  });

  if (projectId) {
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId: access.userId!,
        type: "SCRIPT_CREATED",
        message: `New screenplay "${script.title}" added to the project library.`,
        metadata: JSON.stringify({ scriptId: script.id }),
      },
    });
  }

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
        expectedUpdatedAt?: string;
        createVersion?: boolean;
        versionLabel?: string;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const gate = await ensureScriptAccess(body.id);
  if (gate.error) return gate.error;
  if (!gate.access.canWrite) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  if (
    body.expectedUpdatedAt &&
    gate.access.script.updatedAt.toISOString() !== body.expectedUpdatedAt
  ) {
    return NextResponse.json(
      {
        error: "conflict",
        script: gate.access.script,
        message: "Another collaborator saved changes. Reload to merge.",
      },
      { status: 409 },
    );
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

  const script = await prisma.creatorScript.update({
    where: { id: body.id },
    data,
  });

  if (body.createVersion || body.content !== undefined) {
    await prisma.creatorScriptVersion.create({
      data: {
        scriptId: script.id,
        versionLabel: body.versionLabel?.trim() || "Auto-save snapshot",
        content: script.content,
        createdById: gate.access.userId,
      },
    });
  }

  if (script.projectId && body.content !== undefined) {
    await prisma.projectActivity.create({
      data: {
        projectId: script.projectId,
        userId: gate.access.userId,
        type: "SCRIPT_UPDATED",
        message: `Screenplay "${script.title}" was updated.`,
        metadata: JSON.stringify({ scriptId: script.id }),
      },
    });
  }

  return NextResponse.json({ script });
}
