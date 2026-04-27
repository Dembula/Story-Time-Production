import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CREATOR_WATCH_POOL_REPORTING,
  MARKETPLACE_PAYEE_SETTLED_REPORTING,
  buildAdminRevenueReportingMeta,
  getCalendarMonthToDateRange,
  computeLocationBookingBaseZar,
  MARKETPLACE_TRANSACTION_TYPE,
} from "./financial-ledger";

describe("computeLocationBookingBaseZar", () => {
  it("returns daily rate for single-day when start equals end", () => {
    const d = "2026-01-01T12:00:00.000Z";
    assert.equal(computeLocationBookingBaseZar({ dailyRate: 100, startDate: d, endDate: d }), 100);
  });

  it("uses at least one day for valid range", () => {
    const start = "2026-01-01T00:00:00.000Z";
    const end = "2026-01-01T23:59:59.000Z";
    const z = computeLocationBookingBaseZar({ dailyRate: 50, startDate: start, endDate: end });
    assert.equal(z, 50);
  });

  it("rounds fractional totals to two decimals", () => {
    const z = computeLocationBookingBaseZar({
      dailyRate: 33.33,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-01-04T00:00:00.000Z",
    });
    assert.equal(z, 99.99);
  });

  it("falls back to one day at rate when dates missing", () => {
    assert.equal(computeLocationBookingBaseZar({ dailyRate: 200, startDate: null, endDate: null }), 200);
  });

  it("uses 500 placeholder when rate is zero and dates invalid", () => {
    assert.equal(computeLocationBookingBaseZar({ dailyRate: 0, startDate: "x", endDate: "y" }), 500);
  });
});

describe("buildAdminRevenueReportingMeta", () => {
  it("embeds ISO range for the primary window", () => {
    const start = new Date("2026-04-01T00:00:00.000Z");
    const end = new Date("2026-04-26T12:00:00.000Z");
    const m = buildAdminRevenueReportingMeta(start, end);
    assert.equal(m.primaryWindow.periodStartIso, start.toISOString());
    assert.equal(m.primaryWindow.periodEndIso, end.toISOString());
    assert.ok(m.lines.monthToDate.length > 0);
    assert.equal(m.lines.allTime.length, 0);
    assert.ok(m.lines.monthToDate.some((s) => s.toLowerCase().includes("sync")));
  });
});

describe("getCalendarMonthToDateRange", () => {
  it("starts from the first day of month", () => {
    const now = new Date("2026-04-26T12:00:00.000Z");
    const { periodStart, periodEnd } = getCalendarMonthToDateRange(now);
    assert.equal(periodEnd.toISOString(), now.toISOString());
    assert.equal(periodStart.getDate(), 1);
    assert.equal(periodStart.getMonth(), now.getMonth());
    assert.equal(periodStart.getFullYear(), now.getFullYear());
  });
});

describe("reporting constants", () => {
  it("exposes consistent settled reporting labels", () => {
    assert.equal(MARKETPLACE_PAYEE_SETTLED_REPORTING.settledWindow, "all_time_completed_transactions");
    assert.equal(CREATOR_WATCH_POOL_REPORTING.poolWindow, "calendar_month_to_date");
  });
});

describe("MARKETPLACE_TRANSACTION_TYPE", () => {
  it("includes location and catering booking keys", () => {
    assert.equal(MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING, "LOCATION_BOOKING");
    assert.equal(MARKETPLACE_TRANSACTION_TYPE.CATERING_BOOKING, "CATERING_BOOKING");
  });
});
