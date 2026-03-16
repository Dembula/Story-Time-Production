import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

async function requireProjectMember(projectId: string, req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }

  return { error: null as NextResponse | null, userId };
}

// Fetch current script and versions for a project
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireProjectMember(params.projectId, _req);
  if (auth.error) return auth.error;

  const script = await prisma.projectScript.findFirst({
    where: { projectId: params.projectId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      scenes: {
        orderBy: { number: "asc" },
      },
    },
  });

  return NextResponse.json({ script });
}

// Upsert script content with autosave support
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireProjectMember(params.projectId, req);
  if (auth.error) return auth.error;
  const userId = auth.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        content?: string;
        versionLabel?: string;
        createNewVersion?: boolean;
        title?: string;
      }
    | null;

  if (!body?.content && !body?.title) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  let script = await prisma.projectScript.findFirst({
    where: { projectId: params.projectId },
  });

  if (!script) {
    script = await prisma.projectScript.create({
      data: {
        projectId: params.projectId,
        title: body.title || "Screenplay",
      },
    });
  } else if (body.title) {
    script = await prisma.projectScript.update({
      where: { id: script.id },
      data: { title: body.title },
    });
  }

  if (body.content) {
    if (body.createNewVersion) {
      const version = await prisma.projectScriptVersion.create({
        data: {
          scriptId: script.id,
          content: body.content,
          versionLabel: body.versionLabel || null,
          createdById: userId,
          autoSavedAt: new Date(),
        },
      });

      await prisma.projectScript.update({
        where: { id: script.id },
        data: { currentVersionId: version.id },
      });
    } else {
      // Update latest version or create one if none exists
      const latest = await prisma.projectScriptVersion.findFirst({
        where: { scriptId: script.id },
        orderBy: { createdAt: "desc" },
      });

      if (!latest) {
        const version = await prisma.projectScriptVersion.create({
          data: {
            scriptId: script.id,
            content: body.content,
            versionLabel: body.versionLabel || null,
            createdById: userId,
            autoSavedAt: new Date(),
          },
        });
        await prisma.projectScript.update({
          where: { id: script.id },
          data: { currentVersionId: version.id },
        });
      } else {
        await prisma.projectScriptVersion.update({
          where: { id: latest.id },
          data: {
            content: body.content,
            autoSavedAt: new Date(),
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

