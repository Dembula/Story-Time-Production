import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveModocTaskKind } from "./task-kind";

describe("resolveModocTaskKind", () => {
  it("does not treat story time platform questions as creative", () => {
    const kind = resolveModocTaskKind({
      lastUserText: "how good is the story time platform",
    });
    assert.equal(kind, "chat");
  });

  it("routes screenplay writing to creative", () => {
    const kind = resolveModocTaskKind({
      lastUserText: "help me write a story about a taxi driver",
    });
    assert.equal(kind, "creative");
  });

  it("routes budget questions to logic", () => {
    const kind = resolveModocTaskKind({
      task: "budget",
      lastUserText: "build my budget",
    });
    assert.equal(kind, "logic");
  });
});
