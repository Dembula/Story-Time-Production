import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CREATOR_VA_ROLE } from "@/lib/modoc/creator-va";
import { VIEWER_VA_ROLE } from "@/lib/modoc/viewer-va";
import { planModocOrchestration } from "./intent-router";

describe("planModocOrchestration", () => {
  it("routes creator budget task to agent.finance", () => {
    const plan = planModocOrchestration({
      sessionRole: CREATOR_VA_ROLE,
      scope: "creator",
      path: "/creator/projects/abc",
      pageContext: { task: "budget", projectId: "abc" },
      lastUserText: "build my budget",
    });

    assert.equal(plan.primaryAgentId, "agent.finance");
    assert.equal(plan.taskKind, "logic");
  });

  it("routes viewer browse scope to agent.discovery", () => {
    const plan = planModocOrchestration({
      sessionRole: VIEWER_VA_ROLE,
      scope: "browse",
      path: "/browse/search",
      lastUserText: "find something uplifting",
    });

    assert.equal(plan.primaryAgentId, "agent.discovery");
    assert.equal(plan.taskKind, "chat");
  });

  it("defaults to modoc.legacy for ambiguous scope", () => {
    const plan = planModocOrchestration({
      sessionRole: "ADMIN",
      path: "/admin",
    });

    assert.equal(plan.primaryAgentId, "modoc.legacy");
  });
});
