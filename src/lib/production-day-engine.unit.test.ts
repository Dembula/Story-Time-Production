import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirror production-day-engine unit logic for tests. */
function unitsShareResources(aUnit: string | null | undefined, bUnit: string | null | undefined): boolean {
  const normalize = (u: string | null | undefined) => (u?.trim().toUpperCase() || "A");
  return normalize(aUnit) === normalize(bUnit);
}

describe("unit-aware scheduling conflicts", () => {
  it("Unit A and Unit B on same date do not share resources", () => {
    assert.equal(unitsShareResources("A", "B"), false);
    assert.equal(unitsShareResources("a", "b"), false);
  });

  it("Same unit or both default to A", () => {
    assert.equal(unitsShareResources("A", "A"), true);
    assert.equal(unitsShareResources(null, null), true);
    assert.equal(unitsShareResources("A", null), true);
    assert.equal(unitsShareResources(null, "B"), false);
  });
});
