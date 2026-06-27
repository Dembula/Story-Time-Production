import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTagsList, slugEntityId } from "./utils";

describe("knowledge graph utils", () => {
  it("slugifies actor names", () => {
    assert.equal(slugEntityId("Thabo Mokoena"), "thabo-mokoena");
  });

  it("parses comma-separated tags", () => {
    assert.deepEqual(parseTagsList("drama, thriller; comedy"), ["drama", "thriller", "comedy"]);
  });
});
