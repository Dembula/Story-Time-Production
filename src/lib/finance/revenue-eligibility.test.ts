import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Pure helpers for grandfathered reactivation tagging (mirrors eligibility intent).
 * Full isClearedCreatorPoolEligiblePayment needs DB — covered by finance overview integration.
 */
function grandfatheredPurposeCountsTowardPool(
  purpose: string,
  metadata?: Record<string, unknown> | null,
): boolean {
  const p = purpose.toLowerCase();
  return (
    p.includes("renewal") ||
    p.includes("reactivate") ||
    metadata?.reactivation === true ||
    metadata?.resume === true ||
    metadata?.source === "auto_renewal"
  );
}

describe("grandfathered viewer pool eligibility", () => {
  it("excludes plain first subscription charges", () => {
    assert.equal(grandfatheredPurposeCountsTowardPool("viewer_subscription"), false);
  });

  it("includes renewals and reactivations", () => {
    assert.equal(grandfatheredPurposeCountsTowardPool("viewer_subscription_renewal"), true);
    assert.equal(grandfatheredPurposeCountsTowardPool("viewer_subscription_reactivate"), true);
  });

  it("includes resume/reactivation metadata even when purpose was mis-tagged", () => {
    assert.equal(
      grandfatheredPurposeCountsTowardPool("viewer_subscription", {
        reactivation: true,
        resume: true,
      }),
      true,
    );
  });
});
