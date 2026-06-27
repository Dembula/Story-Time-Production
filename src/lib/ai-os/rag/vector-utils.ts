import { EMBEDDING_DIM } from "@/lib/ai-metadata/embeddings";

export { EMBEDDING_DIM };

/** Format a float array for pgvector SQL literal: '[0.1,0.2,...]' */
export function vectorToPgLiteral(vec: number[]): string {
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(`Expected ${EMBEDDING_DIM}-dim vector, got ${vec.length}`);
  }
  return `[${vec.map((n) => Number(n).toFixed(8)).join(",")}]`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
