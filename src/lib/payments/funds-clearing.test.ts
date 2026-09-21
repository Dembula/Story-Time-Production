import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLE_FUNDS_CLEAR_DAYS,
  PAYFAST_FUNDS_CLEAR_DAYS,
  computeFundsClearDueAt,
  describeFundsClearStatus,
  fundsClearDelayDaysForProvider,
} from "@/lib/payments/funds-clearing-policy";
import { CREATOR_REVENUE_GO_LIVE_AT } from "@/lib/finance/revenue-tracking-start";

describe("funds-clearing clocks", () => {
  it("uses 3 days for PayFast and 45 for Apple", () => {
    assert.equal(fundsClearDelayDaysForProvider("PAYFAST"), PAYFAST_FUNDS_CLEAR_DAYS);
    assert.equal(fundsClearDelayDaysForProvider("APPLE"), APPLE_FUNDS_CLEAR_DAYS);
    assert.equal(PAYFAST_FUNDS_CLEAR_DAYS, 3);
    assert.equal(APPLE_FUNDS_CLEAR_DAYS, 45);
  });

  it("computes clear-due from paidAt", () => {
    const paidAt = new Date("2026-09-18T10:00:00.000Z");
    const pf = computeFundsClearDueAt(paidAt, "PAYFAST");
    const apple = computeFundsClearDueAt(paidAt, "APPLE");
    assert.equal(pf.toISOString(), "2026-09-21T10:00:00.000Z");
    assert.equal(apple.toISOString(), "2026-11-02T10:00:00.000Z");
  });

  it("describes pending and cleared states with provider day tags", () => {
    const paidAt = new Date("2026-09-18T10:00:00.000Z");
    const due = computeFundsClearDueAt(paidAt, "PAYFAST");
    const pending = describeFundsClearStatus({
      provider: "PAYFAST",
      paidAt,
      fundsClearDueAt: due,
      fundsClearedAt: null,
      trackingStartedAt: CREATOR_REVENUE_GO_LIVE_AT,
      now: new Date("2026-09-19T10:00:00.000Z"),
    });
    assert.equal(pending.status, "pending");
    assert.equal(pending.daysRemaining, 2);
    assert.match(pending.label, /Clears in 2 days · PayFast 3d/);

    const cleared = describeFundsClearStatus({
      provider: "APPLE",
      paidAt,
      fundsClearDueAt: computeFundsClearDueAt(paidAt, "APPLE"),
      fundsClearedAt: new Date("2026-09-20T10:00:00.000Z"),
      fundsClearedMode: "manual",
      trackingStartedAt: CREATOR_REVENUE_GO_LIVE_AT,
    });
    assert.equal(cleared.status, "cleared");
    assert.match(cleared.label, /early clear/);
  });

  it("excludes payments before tracking start from clear clocks", () => {
    const paidAt = new Date("2026-09-15T07:19:59.000Z");
    const pre = describeFundsClearStatus({
      provider: "PAYFAST",
      paidAt,
      fundsClearDueAt: computeFundsClearDueAt(paidAt, "PAYFAST"),
      fundsClearedAt: null,
      trackingStartedAt: CREATOR_REVENUE_GO_LIVE_AT,
      now: new Date("2026-09-21T12:00:00.000Z"),
    });
    assert.equal(pre.status, "not_applicable");
    assert.equal(pre.label, "Before tracking");
    assert.equal(pre.daysRemaining, null);
    assert.equal(pre.clearDueAt, null);

    // Even if somehow stamped cleared, pre-tracking remains excluded from clocks.
    const preCleared = describeFundsClearStatus({
      provider: "APPLE",
      paidAt: new Date("2026-09-05T11:39:34.000Z"),
      fundsClearedAt: new Date("2026-09-20T00:00:00.000Z"),
      fundsClearedMode: "manual",
      trackingStartedAt: CREATOR_REVENUE_GO_LIVE_AT,
    });
    assert.equal(preCleared.status, "not_applicable");
    assert.equal(preCleared.label, "Before tracking");
  });

  it("Apple countdown is exact against 45-day due", () => {
    const paidAt = new Date("2026-09-18T12:00:00.000Z");
    const due = computeFundsClearDueAt(paidAt, "APPLE");
    const status = describeFundsClearStatus({
      provider: "APPLE",
      paidAt,
      fundsClearDueAt: due,
      fundsClearedAt: null,
      trackingStartedAt: CREATOR_REVENUE_GO_LIVE_AT,
      now: new Date("2026-09-21T12:00:00.000Z"),
    });
    assert.equal(status.status, "pending");
    assert.equal(status.daysRemaining, 42);
    assert.match(status.label, /Clears in 42 days · Apple 45d/);
  });
});
