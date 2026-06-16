import "server-only";

import { prisma } from "@/lib/prisma";
import { parsePlatformScriptVersionId } from "@/lib/content-catalogue-tags";
import { resolveScriptText } from "@/lib/modoc/va-script-text";
import { fetchScriptTextFromUrl } from "@/lib/ai-metadata/extract-script-document";

export type ContentScriptSource = "platform-version" | "linked-project" | "uploaded-document";

export type ResolvedContentScript = {
  source: ContentScriptSource;
  text: string;
  label: string;
};

/** Resolve screenplay text for catalogue playback intelligence (platform, linked project, or upload). */
export async function resolveContentScriptText(contentId: string): Promise<ResolvedContentScript | null> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      title: true,
      scriptUrl: true,
      tags: true,
      linkedProjectId: true,
    },
  });
  if (!content) return null;

  const versionId = parsePlatformScriptVersionId(content.tags);
  if (versionId) {
    const version = await prisma.projectScriptVersion.findUnique({
      where: { id: versionId },
      select: {
        content: true,
        script: { select: { title: true } },
      },
    });
    if (version?.content?.trim()) {
      return {
        source: "platform-version",
        text: version.content.trim(),
        label: version.script?.title ?? content.title,
      };
    }
  }

  if (content.linkedProjectId) {
    const script = await prisma.projectScript.findFirst({
      where: { projectId: content.linkedProjectId },
      select: {
        title: true,
        currentVersionId: true,
        versions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, content: true },
        },
      },
    });
    if (script) {
      const text = resolveScriptText({
        currentVersionId: script.currentVersionId,
        versions: script.versions,
      });
      if (text) {
        return {
          source: "linked-project",
          text,
          label: script.title,
        };
      }
    }
  }

  const scriptUrl = content.scriptUrl?.trim();
  if (scriptUrl) {
    const text = await fetchScriptTextFromUrl(scriptUrl);
    if (text) {
      return {
        source: "uploaded-document",
        text,
        label: content.title,
      };
    }
  }

  return null;
}

export function contentHasScriptSource(input: {
  scriptUrl?: string | null;
  tags?: string | null;
  linkedProjectId?: string | null;
}): boolean {
  return Boolean(
    input.scriptUrl?.trim() ||
      input.linkedProjectId?.trim() ||
      parsePlatformScriptVersionId(input.tags),
  );
}
