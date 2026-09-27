import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectAppleStoreFreeTrial,
  detectGoogleStoreFreeTrial,
} from "@/lib/payments/store-trial";

describe("store free trial detection", () => {
  it("detects Apple FREE_TRIAL offerDiscountType", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const trial = detectAppleStoreFreeTrial(
      {
        transactionId: "t1",
        originalTransactionId: "o1",
        productId: "com.storytime.universe.sub.base.monthly",
        offerDiscountType: "FREE_TRIAL",
        offerType: 1,
        price: 0,
        expiresDate: Date.parse("2026-10-04T12:00:00.000Z"),
      },
      { now },
    );
    assert.equal(trial.isFreeTrial, true);
    assert.equal(trial.trialEndsAt?.toISOString(), "2026-10-04T12:00:00.000Z");
  });

  it("does not treat paid renewals as trials", () => {
    const trial = detectAppleStoreFreeTrial({
      transactionId: "t2",
      originalTransactionId: "o2",
      productId: "com.storytime.universe.sub.base.monthly",
      price: 29000,
      transactionReason: "RENEWAL",
    });
    assert.equal(trial.isFreeTrial, false);
  });

  it("detects Google client free-trial flag", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const trial = detectGoogleStoreFreeTrial({
      productId: "stu.sub.base.monthly",
      isFreeTrial: true,
      now,
    });
    assert.equal(trial.isFreeTrial, true);
    assert.ok(trial.trialEndsAt);
  });

  it("detects creator pipeline monthly Apple free trial", () => {
    const trial = detectAppleStoreFreeTrial({
      transactionId: "t3",
      originalTransactionId: "o3",
      productId: "online.storytime.creators.sub.pipeline.monthly",
      offerType: 1,
      price: 0,
    });
    assert.equal(trial.isFreeTrial, true);
  });
});
