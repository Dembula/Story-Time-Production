import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "crypto";
import {
  encodePayFastPhpUrlencode,
  generatePayFastApiSignature,
  generatePayFastSignature,
} from "@/lib/payments/providers/payfast-signature";

describe("payfast API signature (adhoc renewals)", () => {
  it("includes passphrase as a sorted field, not appended after an unsorted list", () => {
    const prev = process.env.PAYFAST_PASSPHRASE;
    process.env.PAYFAST_PASSPHRASE = "secret-pass";

    try {
      const payload = {
        amount: "2900",
        item_name: "Story Time renewal pf-renew",
        "merchant-id": "10000100",
        timestamp: "2026-11-13T10:00:00",
        version: "v1",
      };

      const apiSig = generatePayFastApiSignature(payload);

      // Manual expected: alphabetical keys + passphrase as a field.
      const withPass = { ...payload, passphrase: "secret-pass" };
      const expected = createHash("md5")
        .update(
          Object.keys(withPass)
            .sort()
            .map((key) => `${key}=${encodePayFastPhpUrlencode(String(withPass[key as keyof typeof withPass]), true)}`)
            .join("&"),
        )
        .digest("hex");

      assert.equal(apiSig, expected);

      // Checkout-style helper appends passphrase and must NOT be used for API adhoc.
      const checkoutStyle = generatePayFastSignature(payload, "secret-pass");
      assert.notEqual(apiSig, checkoutStyle);
    } finally {
      if (prev === undefined) delete process.env.PAYFAST_PASSPHRASE;
      else process.env.PAYFAST_PASSPHRASE = prev;
    }
  });

  it("signs body fields required by PayFast adhoc (amount + item_name)", () => {
    const prev = process.env.PAYFAST_PASSPHRASE;
    process.env.PAYFAST_PASSPHRASE = "jt7NOE43FZPn";

    try {
      const headersOnly = generatePayFastApiSignature({
        "merchant-id": "10000100",
        version: "v1",
        timestamp: "2026-11-13T10:00:00",
        amount: "2900",
      });
      const withBody = generatePayFastApiSignature({
        "merchant-id": "10000100",
        version: "v1",
        timestamp: "2026-11-13T10:00:00",
        amount: "2900",
        item_name: "Story Time renewal",
        m_payment_id: "payment-record-1",
        custom_str1: "payment-record-1",
      });
      assert.notEqual(headersOnly, withBody);
      assert.equal(withBody.length, 32);
    } finally {
      if (prev === undefined) delete process.env.PAYFAST_PASSPHRASE;
      else process.env.PAYFAST_PASSPHRASE = prev;
    }
  });
});
