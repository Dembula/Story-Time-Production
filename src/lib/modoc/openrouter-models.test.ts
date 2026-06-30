import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOpenRouterModelId, resolveModelChain, OPENROUTER_DEFAULT_MODELS } from "./openrouter-models";

describe("normalizeOpenRouterModelId", () => {
  it("maps retired claude-3.5-sonnet to claude-sonnet-4.5", () => {
    assert.equal(
      normalizeOpenRouterModelId("anthropic/claude-3.5-sonnet"),
      "anthropic/claude-sonnet-4.5",
    );
  });
});

describe("resolveModelChain", () => {
  it("normalizes env models and dedupes fallbacks", () => {
    const chain = resolveModelChain(
      ["anthropic/claude-3.5-sonnet"],
      OPENROUTER_DEFAULT_MODELS.chat,
    );
    assert.equal(chain[0], "anthropic/claude-sonnet-4.5");
    assert.ok(chain.includes("openai/gpt-4o-mini"));
  });
});
