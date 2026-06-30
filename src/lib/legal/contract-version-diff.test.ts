import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffContractTerms, summarizeContractDiff } from "./contract-version-diff";

describe("contract-version-diff", () => {
  it("detects added and changed lines", () => {
    const diff = diffContractTerms("line one\nline two", "line one\nline TWO changed");
    const summary = summarizeContractDiff(diff);
    assert.equal(summary.changed, 1);
    assert.equal(summary.added, 0);
    assert.equal(summary.removed, 0);
  });
});
