import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeOpenRouterModelId, resolveModelChain, OPENROUTER_DEFAULT_MODELS } from "./openrouter-models";

describe("normalizeOpenRouterModelId", () => {
  it("maps retired claude-3.5-sonnet to claude-sonnet-5.5", () => {
    assert.equal(
      normalizeOpenRouterModelId("anthropic/claude-3.5-sonnet"),
      "anthropic/claude-sonnet-5.5",
    );
  });

  it("maps astra aliases to gpt-6-astra", () => {
    assert.equal(normalizeOpenRouterModelId("astra"), "openai/gpt-6-astra");
    assert.equal(normalizeOpenRouterModelId("astra-6"), "openai/gpt-6-astra");
    assert.equal(normalizeOpenRouterModelId("astra-pro"), "openai/gpt-6-astra-pro");
  });

  it("maps opus shorthand to claude-opus-5.5", () => {
    assert.equal(normalizeOpenRouterModelId("claude-opus-5.5"), "anthropic/claude-opus-5.5");
  });
});

describe("resolveModelChain", () => {
  it("normalizes env models and dedupes fallbacks", () => {
    const chain = resolveModelChain(
      ["anthropic/claude-3.5-sonnet"],
      OPENROUTER_DEFAULT_MODELS.chat,
    );
    assert.equal(chain[0], "anthropic/claude-sonnet-5.5");
    assert.ok(chain.includes("openai/gpt-6-astra"));
  });

  it("keeps flagship defaults for power and logic", () => {
    assert.equal(OPENROUTER_DEFAULT_MODELS.power[0], "openai/gpt-6-astra-pro");
    assert.equal(OPENROUTER_DEFAULT_MODELS.logic[0], "openai/gpt-6-astra-pro");
    assert.equal(OPENROUTER_DEFAULT_MODELS.creative[0], "openai/gpt-6-astra");
  });
});
