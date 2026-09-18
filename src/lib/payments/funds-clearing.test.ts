import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLE_FUNDS_CLEAR_DAYS,
  PAYFAST_FUNDS_CLEAR_DAYS,
  computeFundsClearDueAt,
  describeFundsClearStatus,
  fundsClearDelayDaysForProvider,
} from "@/lib/payments/funds-clearing-policy";

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

  it("describes pending and cleared states", () => {
    const paidAt = new Date("2026-09-18T10:00:00.000Z");
    const due = computeFundsClearDueAt(paidAt, "PAYFAST");
    const pending = describeFundsClearStatus({
      provider: "PAYFAST",
      paidAt,
      fundsClearDueAt: due,
      fundsClearedAt: null,
      now: new Date("2026-09-19T10:00:00.000Z"),
    });
    assert.equal(pending.status, "pending");
    assert.equal(pending.daysRemaining, 2);

    const cleared = describeFundsClearStatus({
      provider: "APPLE",
      paidAt,
      fundsClearDueAt: computeFundsClearDueAt(paidAt, "APPLE"),
      fundsClearedAt: new Date("2026-09-20T10:00:00.000Z"),
      fundsClearedMode: "manual",
    });
    assert.equal(cleared.status, "cleared");
    assert.match(cleared.label, /early clear/);
  });
});
