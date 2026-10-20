import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FESTIVAL_CURATOR_SHARE,
  FESTIVAL_PLATFORM_SHARE,
  splitFestivalSubmissionSettlement,
} from "./fee-split";

describe("splitFestivalSubmissionSettlement", () => {
  it("gives 85% to the festival curator and 15% to Story Time", () => {
    const split = splitFestivalSubmissionSettlement(100);
    assert.equal(split.festivalNetZar, 85);
    assert.equal(split.platformFeeZar, 15);
    assert.equal(split.curatorShare, FESTIVAL_CURATOR_SHARE);
    assert.equal(split.platformShare, FESTIVAL_PLATFORM_SHARE);
  });

  it("rounds money and keeps parts summing to settlement", () => {
    const settlement = 99.99;
    const split = splitFestivalSubmissionSettlement(settlement);
    assert.equal(round2(split.festivalNetZar + split.platformFeeZar), round2(settlement));
  });
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
