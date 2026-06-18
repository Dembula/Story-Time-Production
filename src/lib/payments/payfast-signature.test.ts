import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPayFastCheckoutParamString,
  buildPayFastItnParamString,
  buildPayFastItnValidatePayload,
  generatePayFastCheckoutSignature,
  parsePayFastFormBodyOrdered,
  verifyPayFastItnSignatureFromRawBody,
} from "@/lib/payments/providers/payfast-signature";

/** PayFast custom integration Step 2 sandbox example from official docs. */
const DOC_CHECKOUT_DATA = {
  merchant_id: "10000100",
  merchant_key: "46f0cd694581a",
  return_url: "http://www.yourdomain.co.za/return.php",
  cancel_url: "http://www.yourdomain.co.za/cancel.php",
  notify_url: "http://www.yourdomain.co.za/notify.php",
  name_first: "First Name",
  name_last: "Last Name",
  email_address: "test@test.com",
  m_payment_id: "1234",
  amount: "10.00",
  item_name: "Order#123",
};

const DOC_PASSPHRASE = "jt7NOE43FZPn";

describe("payfast-signature", () => {
  it("builds checkout param strings in PayFast documentation field order", () => {
    const paramString = buildPayFastCheckoutParamString(DOC_CHECKOUT_DATA, DOC_PASSPHRASE);
    assert.match(paramString, /^merchant_id=/);
    assert.ok(paramString.indexOf("merchant_key=") > paramString.indexOf("merchant_id="));
    assert.ok(paramString.indexOf("return_url=") > paramString.indexOf("merchant_key="));
    assert.ok(paramString.indexOf("notify_url=") > paramString.indexOf("cancel_url="));
    assert.ok(paramString.endsWith(`passphrase=${DOC_PASSPHRASE}`));
    assert.equal(generatePayFastCheckoutSignature(DOC_CHECKOUT_DATA, DOC_PASSPHRASE).length, 32);
  });

  it("verifies ITN signature using POST field order until signature", () => {
    const rawBody =
      "m_payment_id=SuperUnique1&pf_payment_id=1089250&payment_status=COMPLETE&item_name=test+product&amount_gross=200.00&amount_fee=-4.60&amount_net=195.40&merchant_id=10012577&signature=ad8e7685c9522c24365d7ccea8cb3db7";

    const pairs = parsePayFastFormBodyOrdered(rawBody);
    const paramString = buildPayFastItnParamString(pairs, null);
    assert.ok(paramString.includes("m_payment_id=SuperUnique1"));
    assert.ok(!paramString.includes("signature="));

    const validatePayload = buildPayFastItnValidatePayload(rawBody);
    assert.equal(validatePayload, paramString);
  });

  it("round-trips checkout signatures for ITN-style POST bodies", () => {
    const data = { ...DOC_CHECKOUT_DATA, payment_status: "COMPLETE", pf_payment_id: "1089250" };
    const signature = generatePayFastCheckoutSignature(data, DOC_PASSPHRASE);
    const rawBody = new URLSearchParams({ ...data, signature }).toString();

    assert.equal(
      verifyPayFastItnSignatureFromRawBody(rawBody, signature, DOC_PASSPHRASE),
      true,
    );
  });
});
