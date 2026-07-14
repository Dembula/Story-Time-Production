import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getScreenplaySuggestions,
  isSceneHeadingPrefixQuery,
} from "./screenplay-autocomplete";

describe("screenplay-autocomplete", () => {
  it("offers INT/EXT prefixes on an empty action line", () => {
    const suggestions = getScreenplaySuggestions({
      content: "",
      line: "",
      element: "action",
    });
    const labels = suggestions.map((s) => s.label);
    assert.ok(labels.includes("INT."));
    assert.ok(labels.includes("EXT."));
  });

  it("keeps prefixes while typing a matching slugline start", () => {
    const suggestions = getScreenplaySuggestions({
      content: "",
      line: "IN",
      element: "scene_heading",
    });
    assert.ok(suggestions.some((s) => s.label === "INT."));
    assert.ok(!suggestions.some((s) => s.label === "EXT."));
  });

  it("does not keep the INT/EXT menu open for random prose", () => {
    const suggestions = getScreenplaySuggestions({
      content: "",
      line: "fbhfhf",
      element: "scene_heading",
    });
    assert.equal(
      suggestions.filter((s) => /^(INT\.|EXT\.|EST\.|I\/E\.)/.test(s.label)).length,
      0,
    );
  });

  it("classifies prefix queries correctly", () => {
    assert.equal(isSceneHeadingPrefixQuery(""), true);
    assert.equal(isSceneHeadingPrefixQuery("i"), true);
    assert.equal(isSceneHeadingPrefixQuery("int"), true);
    assert.equal(isSceneHeadingPrefixQuery("ex"), true);
    assert.equal(isSceneHeadingPrefixQuery("bd"), false);
    assert.equal(isSceneHeadingPrefixQuery("fbhfhf"), false);
  });

  it("suggests prior locations after a prefix", () => {
    const suggestions = getScreenplaySuggestions({
      content: "INT. KITCHEN - DAY\n\nAction.\n",
      line: "INT. K",
      element: "scene_heading",
    });
    assert.ok(suggestions.some((s) => s.label.includes("KITCHEN")));
  });
});
