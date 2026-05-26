import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankSearchResults, scoreSearchMatch } from "./browse-search";

describe("browse-search", () => {
  it("ranks exact title matches highest", () => {
    const items = [
      { id: "1", title: "Other Film", description: null, category: null, type: "MOVIE", tags: null },
      { id: "2", title: "Sunset Drive", description: null, category: null, type: "MOVIE", tags: null },
    ];
    const ranked = rankSearchResults(items, "Sunset Drive");
    assert.equal(ranked[0]?.id, "2");
  });

  it("scores creator name matches", () => {
    const score = scoreSearchMatch(
      {
        id: "1",
        title: "Hidden Gem",
        description: null,
        category: null,
        type: "MOVIE",
        tags: null,
        creator: { name: "Jane Doe" },
      },
      "jane",
    );
    assert.ok(score > 0);
  });
});
