import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity } from "./embeddings";

describe("embeddings", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 0, 0];
    assert.equal(cosineSimilarity(v, v), 1);
  });

  it("returns 0 for orthogonal vectors", () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });
});
