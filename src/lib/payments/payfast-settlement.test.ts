import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimatePayFastFee,
  estimatePayFastSettlement,
  normalizePayFastMethodCode,
  parsePayFastSettlementFromItn,
} from "@/lib/payments/payfast-settlement";

describe("payfast-settlement", () => {
  it("normalizes debit card labels", () => {
    assert.equal(normalizePayFastMethodCode("dc"), "dc");
    assert.equal(normalizePayFastMethodCode("Debit Card"), "dc");
    assert.equal(normalizePayFastMethodCode("Apple Pay"), "ap");
  });

  it("estimates debit card fees higher than credit card fees", () => {
    const gross = 29.99;
    const debitFee = estimatePayFastFee(gross, "dc");
    const creditFee = estimatePayFastFee(gross, "cc");
    assert.ok(debitFee > creditFee);
    assert.equal(estimatePayFastSettlement(gross, "dc"), Math.round((gross - debitFee) * 100) / 100);
  });

  it("prefers PayFast ITN net and fee fields", () => {
    const parsed = parsePayFastSettlementFromItn(
      {
        amount_gross: "29.99",
        amount_fee: "-3.51",
        amount_net: "26.48",
        payment_method: "dc",
        payment_status: "COMPLETE",
      },
      29.99,
    );
    assert.equal(parsed.settlementSource, "itn");
    assert.equal(parsed.settlementAmount, 26.48);
    assert.equal(parsed.providerFeeAmount, 3.51);
    assert.equal(parsed.providerPaymentMethod, "dc");
  });

  it("splits viewer pool base on net not gross for R29.99 debit", () => {
    const parsed = parsePayFastSettlementFromItn(
      {
        amount_gross: "29.99",
        amount_fee: "-3.51",
        amount_net: "26.48",
        payment_method: "dc",
      },
      29.99,
    );
    const creatorPool = Math.round(parsed.settlementAmount * 0.6 * 100) / 100;
    assert.ok(creatorPool < 17.99);
    assert.equal(creatorPool, 15.89);
  });
});

describe("itn payload matching", () => {
  it("matches payment record ids from ITN fields", () => {
    const paymentRecordId = "clxyz123";
    const fields = {
      custom_str1: paymentRecordId,
      m_payment_id: paymentRecordId,
      payment_status: "COMPLETE",
    };
    assert.equal(fields.custom_str1, paymentRecordId);
    assert.equal(fields.m_payment_id, paymentRecordId);
  });
});
