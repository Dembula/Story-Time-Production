import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import {
  inferDeviceTypeFromPlatformHeader,
  inferDeviceTypeFromUserAgent,
} from "@/lib/client-device-type";
import { CREATOR_FILM_UPLOAD_PURPOSES } from "@/lib/creator-film-upload-payment";
import { isViewerPoolPaymentPurpose } from "@/lib/payments/viewer-pool-purposes";
import {
  CREATOR_APPLE_IAP_LICENSE_PURPOSE,
  CREATOR_APPLE_IAP_UPLOAD_PURPOSE,
} from "@/lib/payments/apple-iap/purposes";
import {
  APPLE_CREATOR_PRODUCTS,
  resolveCreatorAppleProduct,
} from "@/lib/payments/apple-iap/products";
import { createPublicKey, generateKeyPairSync } from "node:crypto";

// cash-recognition is marked server-only; stub that marker for unit tests.
const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

const {
  isCashRecognizedPayment,
  isDemoPaymentRecord,
  getCashSettlementAmount,
} = require("./cash-recognition") as typeof import("./cash-recognition");

describe("Apple IAP cash recognition", () => {
  it("counts production Apple IAP as cash revenue", () => {
    const payment = {
      status: "SUCCEEDED",
      amount: 29.99,
      settlementAmount: 29.99,
      provider: "APPLE",
      settlementSource: "apple_iap",
      purpose: "viewer_subscription_apple_iap",
      metadata: { environment: "Production", source: "ios_app" },
    };
    assert.equal(isDemoPaymentRecord(payment), false);
    assert.equal(isCashRecognizedPayment(payment), true);
    assert.equal(getCashSettlementAmount(payment), 29.99);
  });

  it("excludes StoreKit Sandbox Apple IAP from cash revenue", () => {
    const payment = {
      status: "SUCCEEDED",
      amount: 29.99,
      settlementAmount: 29.99,
      provider: "APPLE",
      settlementSource: "apple_iap",
      purpose: "viewer_subscription_apple_iap",
      metadata: { environment: "Sandbox" },
    };
    assert.equal(isDemoPaymentRecord(payment), true);
    assert.equal(isCashRecognizedPayment(payment), false);
  });

  it("includes Apple IAP purposes in the viewer pool", () => {
    assert.equal(isViewerPoolPaymentPurpose("viewer_subscription_apple_iap"), true);
    assert.equal(isViewerPoolPaymentPurpose("viewer_ppv_apple_iap"), true);
  });

  it("counts production Creator Apple IAP as cash revenue", () => {
    const licensePayment = {
      status: "SUCCEEDED",
      amount: 1499,
      settlementAmount: 1499,
      provider: "APPLE",
      settlementSource: "apple_iap",
      purpose: CREATOR_APPLE_IAP_LICENSE_PURPOSE,
      metadata: { environment: "Production", source: "ios_app" },
    };
    const uploadPayment = {
      ...licensePayment,
      amount: 24.99,
      settlementAmount: 24.99,
      purpose: CREATOR_APPLE_IAP_UPLOAD_PURPOSE,
    };
    assert.equal(isCashRecognizedPayment(licensePayment), true);
    assert.equal(isCashRecognizedPayment(uploadPayment), true);
    assert.equal(getCashSettlementAmount(uploadPayment), 24.99);
  });

  it("maps all Creator iOS product IDs to backend license/upload kinds", () => {
    assert.equal(Object.keys(APPLE_CREATOR_PRODUCTS).length, 4);
    assert.equal(resolveCreatorAppleProduct("online.storytime.creators.sub.upload.yearly")?.kind, "creator_license");
    assert.equal(resolveCreatorAppleProduct("online.storytime.creators.sub.pipeline.monthly")?.package, "PIPELINE_MONTHLY");
    assert.equal(resolveCreatorAppleProduct("online.storytime.creators.sub.pipeline.yearly")?.package, "PIPELINE_YEARLY");
    assert.equal(resolveCreatorAppleProduct("online.storytime.creators.upload.perfilm")?.kind, "content_upload");
  });

  it("treats web and Apple IAP per-film upload purposes as paid uploads", () => {
    assert.equal(CREATOR_FILM_UPLOAD_PURPOSES.includes("creator_film_upload"), true);
    assert.equal(CREATOR_FILM_UPLOAD_PURPOSES.includes(CREATOR_APPLE_IAP_UPLOAD_PURPOSE), true);
  });
});

describe("device type inference for native apps", () => {
  it("classifies Universe iOS User-Agent as mobile", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) StoryTimeUniverseiOS/1.0.1 Mobile/iPhone";
    assert.equal(inferDeviceTypeFromUserAgent(ua), "mobile");
  });

  it("prefers X-ST-Platform headers from native shells", () => {
    assert.equal(inferDeviceTypeFromPlatformHeader("ios_iphone"), "mobile");
    assert.equal(inferDeviceTypeFromPlatformHeader("ios_ipad"), "tablet");
    assert.equal(inferDeviceTypeFromPlatformHeader("android_tv"), "tv");
  });
});

describe("Node 22 Apple leaf key handling", () => {
  it("does not call createPublicKey on an existing PublicKeyObject", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    assert.equal(publicKey.type, "public");
    assert.throws(() => createPublicKey(publicKey), /Invalid key object type public, expected private/);
  });
});
