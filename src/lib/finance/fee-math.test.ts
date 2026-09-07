import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAppleCommission,
  defaultFinanceFeeRates,
  splitViewerRevenueWithRates,
  validateFinanceFeeRates,
} from "./fee-math";
import { DEFAULT_APPLE_COMMISSION_RATE } from "../payments/config";
import { resolveFinancePeriodRange } from "./period-range";

describe("Apple commission default (R29.99 → R22.17)", () => {
  it("applies default rate to catalogue price", () => {
    const applied = applyAppleCommission(29.99, DEFAULT_APPLE_COMMISSION_RATE);
    assert.equal(applied.fee, 7.82);
    assert.equal(applied.settlement, 22.17);
  });

  it("splits net settlement 60/40 for creator pool", () => {
    const rates = defaultFinanceFeeRates();
    const split = splitViewerRevenueWithRates(22.17, rates);
    assert.equal(split.creator, 13.3);
    assert.equal(split.platform, 8.87);
  });
});

describe("validateFinanceFeeRates", () => {
  it("rejects splits that do not sum to 1", () => {
    const result = validateFinanceFeeRates({
      viewerCreatorSplit: 0.7,
      viewerPlatformSplit: 0.2,
    });
    assert.equal(result.ok, false);
  });

  it("accepts valid rates", () => {
    const result = validateFinanceFeeRates({
      appleCommissionRate: 0.3,
      viewerCreatorSplit: 0.6,
      viewerPlatformSplit: 0.4,
      marketplaceFeeRate: 0.03,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.values.appleCommissionRate, 0.3);
  });
});

describe("resolveFinancePeriodRange", () => {
  const now = new Date(2026, 8, 7, 15, 0, 0);

  it("resolves mtd", () => {
    const range = resolveFinancePeriodRange({ period: "mtd", now });
    assert.equal(range.key, "mtd");
    assert.equal(range.periodStart.getDate(), 1);
    assert.equal(range.periodEnd.getDate(), 7);
  });

  it("resolves last_month", () => {
    const range = resolveFinancePeriodRange({ period: "last_month", now });
    assert.equal(range.key, "last_month");
    assert.equal(range.periodStart.getMonth(), 7);
  });

  it("resolves all time from year 2000", () => {
    const range = resolveFinancePeriodRange({ period: "all", now });
    assert.equal(range.periodStart.getFullYear(), 2000);
  });
});
