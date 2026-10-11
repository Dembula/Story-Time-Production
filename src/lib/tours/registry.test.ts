import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findMatchingTours, listRegisteredTourIds, TOUR_REGISTRY } from "@/lib/tours/registry";

describe("tour registry", () => {
  it("registers creator and stakeholder tours", () => {
    const ids = listRegisteredTourIds();
    assert.ok(ids.includes("creator.command-center"));
    assert.ok(ids.includes("creator.pre-production"));
    assert.ok(ids.includes("creator.tool.budget-builder.rich"));
    assert.ok(ids.includes("stakeholder.home.funders"));
    assert.ok(ids.length > 30);
  });

  it("matches command center for creators", () => {
    const matches = findMatchingTours("/creator/command-center", "CONTENT_CREATOR");
    assert.equal(matches[0]?.id, "creator.command-center");
  });

  it("prefers rich tool tour over generic", () => {
    const matches = findMatchingTours(
      "/creator/projects/abc123/pre-production/script-breakdown",
      "CONTENT_CREATOR",
    );
    assert.equal(matches[0]?.id, "creator.tool.script-breakdown.rich");
  });

  it("does not match creator tours for funders", () => {
    const matches = findMatchingTours("/creator/command-center", "FUNDER");
    assert.equal(matches.length, 0);
  });

  it("every tour has at least one step with a data-tour target", () => {
    for (const tour of TOUR_REGISTRY) {
      assert.ok(tour.steps.length > 0, tour.id);
      for (const step of tour.steps) {
        assert.ok(step.target.includes("data-tour") || step.target.startsWith("."), `${tour.id}:${step.id}`);
      }
    }
  });
});
