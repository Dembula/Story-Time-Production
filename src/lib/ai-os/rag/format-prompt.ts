import type { RetrieveKnowledgeResult } from "./types";

/** Format retrieved chunks as a MODOC system-prompt block. Pure — no I/O. */
export function formatRagPromptBlock(result: RetrieveKnowledgeResult): string {
  if (result.chunks.length === 0) return "";

  const lines = result.chunks.map((c, i) => {
    const meta = [
      c.sourceType,
      c.title ? `"${c.title}"` : null,
      c.contentId ? `contentId=${c.contentId}` : null,
      c.projectId ? `projectId=${c.projectId}` : null,
      `score=${c.score.toFixed(3)}`,
    ]
      .filter(Boolean)
      .join(" · ");

    return `${i + 1}. [${meta}]\n${c.chunkText.slice(0, 1200)}`;
  });

  return `

## Retrieved knowledge (RAG — ground answers in this data)
Backend: ${result.vectorBackend}. Use these excerpts as authoritative context. If retrieval conflicts with chat assumptions, prefer retrieved data.

${lines.join("\n\n")}`;
}
