import { prisma } from "@/lib/prisma";

const annotationInclude = {
  author: {
    select: { id: true, name: true, professionalName: true, image: true },
  },
  replies: {
    include: {
      author: {
        select: { id: true, name: true, professionalName: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function resolveScriptReviewDraftContent(session: {
  draftKey: string;
  creatorScriptId: string | null;
  scriptVersionId: string | null;
}): Promise<{ title: string; content: string } | null> {
  if (session.creatorScriptId) {
    const script = await prisma.creatorScript.findUnique({
      where: { id: session.creatorScriptId },
      select: { title: true, content: true },
    });
    if (script) return { title: script.title, content: script.content ?? "" };
  }

  if (session.scriptVersionId) {
    const version = await prisma.projectScriptVersion.findUnique({
      where: { id: session.scriptVersionId },
      select: {
        content: true,
        versionLabel: true,
        script: { select: { title: true } },
      },
    });
    if (version) {
      return {
        title: version.script.title || version.versionLabel || "Script",
        content: version.content ?? "",
      };
    }
  }

  if (session.draftKey.startsWith("creator-script:")) {
    const id = session.draftKey.replace("creator-script:", "");
    const script = await prisma.creatorScript.findUnique({
      where: { id },
      select: { title: true, content: true },
    });
    if (script) return { title: script.title, content: script.content ?? "" };
  }

  if (session.draftKey.startsWith("project-version:")) {
    const id = session.draftKey.replace("project-version:", "");
    const version = await prisma.projectScriptVersion.findUnique({
      where: { id },
      select: {
        content: true,
        versionLabel: true,
        script: { select: { title: true } },
      },
    });
    if (version) {
      return {
        title: version.script.title || version.versionLabel || "Script",
        content: version.content ?? "",
      };
    }
  }

  return null;
}

export { annotationInclude };
