import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRagPromptBlock } from "./format-prompt";
import type { RetrieveKnowledgeResult } from "./types";

describe("formatRagPromptBlock", () => {
  it("returns empty string when no chunks", () => {
    const result: RetrieveKnowledgeResult = {
      chunks: [],
      queryEmbeddingUsed: false,
      vectorBackend: "none",
    };
    assert.equal(formatRagPromptBlock(result), "");
  });

  it("formats retrieved chunks with source metadata", () => {
    const result: RetrieveKnowledgeResult = {
      chunks: [
        {
          id: "1",
          chunkKey: "catalogue:abc",
          sourceType: "catalogue",
          title: "NGIKHONA",
          chunkText: "A drama about family and identity in Johannesburg.",
          score: 0.87,
          contentId: "abc",
        },
      ],
      queryEmbeddingUsed: true,
      vectorBackend: "pgvector",
    };

    const block = formatRagPromptBlock(result);
    assert.match(block, /Retrieved knowledge \(RAG/);
    assert.match(block, /NGIKHONA/);
    assert.match(block, /pgvector/);
    assert.match(block, /score=0\.870/);
  });
});
