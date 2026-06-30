import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyVaIntent } from "./intent-classifier";

describe("classifyVaIntent", () => {
  it("classifies general knowledge as conversational", () => {
    const intent = classifyVaIntent("What is the capital of France?");
    assert.equal(intent.category, "general_knowledge");
    assert.equal(intent.responseMode, "conversational");
    assert.equal(intent.needsWebSearch, false);
  });

  it("classifies current events as web search", () => {
    const intent = classifyVaIntent("What are the latest Sundance 2026 dates?");
    assert.equal(intent.category, "web_current_events");
    assert.equal(intent.needsWebSearch, true);
    assert.equal(intent.responseMode, "conversational");
  });

  it("classifies platform budget questions as production protocol", () => {
    const intent = classifyVaIntent("How much budget is left on camera?", {
      hasProjectContext: true,
    });
    assert.equal(intent.category, "platform_production");
    assert.equal(intent.responseMode, "production_protocol");
  });

  it("classifies cross-module queries", () => {
    const intent = classifyVaIntent(
      "Which actors are attached to scenes that are over budget?",
      { hasProjectContext: true },
    );
    assert.equal(intent.category, "platform_cross_module");
    assert.equal(intent.responseMode, "production_protocol");
  });
});
