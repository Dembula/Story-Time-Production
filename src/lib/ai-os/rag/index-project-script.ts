import { prisma } from "@/lib/prisma";
import { upsertKnowledgeChunk } from "./index-chunk";

const MAX_SCRIPT_CHARS = 8000;

/** Index latest project script text for creator-scoped RAG. */
export async function indexProjectScript(projectId: string, userId?: string): Promise<boolean> {
  const script = await prisma.projectScript.findFirst({
    where: { projectId },
    select: {
      id: true,
      title: true,
      currentVersionId: true,
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, content: true },
      },
    },
  });

  if (!script) return false;

  const version =
    script.versions.find((v) => v.id === script.currentVersionId) ?? script.versions[0];
  const text = version?.content?.trim();
  if (!text) return false;

  const chunkText = text.slice(0, MAX_SCRIPT_CHARS);

  await upsertKnowledgeChunk({
    chunkKey: `project_script:${projectId}`,
    sourceType: "project_script",
    sourceId: version?.id ?? script.id,
    projectId,
    userId: userId ?? null,
    title: script.title,
    chunkText,
    metadata: {
      scriptId: script.id,
      versionId: version?.id,
      truncated: text.length > MAX_SCRIPT_CHARS,
    },
  });

  return true;
}
