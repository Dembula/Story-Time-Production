import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  feeForTier,
  isFestivalFeePayable,
  normalizeFestivalFeeZar,
} from "./constants";

describe("normalizeFestivalFeeZar / isFestivalFeePayable", () => {
  it("treats 0, null, NaN, and negatives as free (not payable)", () => {
    for (const value of [0, 0.0, "0", null, undefined, "", NaN, -1, -0.01]) {
      assert.equal(normalizeFestivalFeeZar(value), 0);
      assert.equal(isFestivalFeePayable(value), false);
    }
  });

  it("keeps positive amounts and rounds to cents", () => {
    assert.equal(normalizeFestivalFeeZar(50), 50);
    assert.equal(normalizeFestivalFeeZar("100.456"), 100.46);
    assert.equal(isFestivalFeePayable(0.01), true);
    assert.equal(isFestivalFeePayable(50), true);
  });
});

describe("feeForTier", () => {
  const category = {
    earlybirdFeeZar: 0,
    regularFeeZar: 50,
    lateFeeZar: 100,
  };

  it("returns free for earlybird when earlybird fee is R0", () => {
    assert.equal(feeForTier(category, "earlybird"), 0);
    assert.equal(isFestivalFeePayable(feeForTier(category, "earlybird")), false);
  });

  it("returns regular and late amounts when set", () => {
    assert.equal(feeForTier(category, "regular"), 50);
    assert.equal(feeForTier(category, "late"), 100);
  });

  it("honours explicit late fee of R0 instead of falling back to regular", () => {
    assert.equal(
      feeForTier({ earlybirdFeeZar: 0, regularFeeZar: 50, lateFeeZar: 0 }, "late"),
      0,
    );
  });

  it("falls back to regular only when late fee is unset", () => {
    assert.equal(
      feeForTier({ earlybirdFeeZar: 0, regularFeeZar: 50, lateFeeZar: null }, "late"),
      50,
    );
  });
});
