import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SYNC_LICENSE_BASE_ZAR } from "./sync-licensing-settlement";
import { computeMarketplaceFeeZar } from "../financial-ledger";

test("DEFAULT_SYNC_LICENSE_BASE_ZAR is positive", () => {
  assert.ok(DEFAULT_SYNC_LICENSE_BASE_ZAR > 0);
});

test("sync licensing fee math matches marketplace pattern", () => {
  const base = 2500;
  const fee = computeMarketplaceFeeZar(base);
  const total = Math.round((base + fee) * 100) / 100;
  assert.ok(fee >= 0);
  assert.ok(total > base);
});
