import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOOGLE_UNIVERSE_PPV_PRODUCT_ID,
  resolveGoogleCreatorProduct,
  resolveGoogleUniverseSubscriptionProduct,
} from "@/lib/payments/apple-iap/products";
import { CREATOR_LICENSE_TYPE } from "@/lib/pricing";

describe("Google Play product maps", () => {
  it("maps universe subscriptions and PPV", () => {
    assert.equal(resolveGoogleUniverseSubscriptionProduct("stu.sub.standard.monthly")?.planCode, "STANDARD_3");
    assert.equal(resolveGoogleUniverseSubscriptionProduct("stu.sub.premium.yearly")?.planCode, "FAMILY_5");
    assert.equal(resolveGoogleUniverseSubscriptionProduct("stu.sub.base.yearly")?.billingInterval, "year");
    assert.equal(GOOGLE_UNIVERSE_PPV_PRODUCT_ID, "stu.ppv.unlock");
  });

  it("maps creator Play products", () => {
    assert.equal(
      resolveGoogleCreatorProduct("st.creators.pipeline.monthly")?.licenseType,
      CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY,
    );
    assert.equal(
      resolveGoogleCreatorProduct("st.creators.pipeline.yearly")?.licenseType,
      CREATOR_LICENSE_TYPE.PIPELINE_YEARLY,
    );
    assert.equal(
      resolveGoogleCreatorProduct("st.creators.catalogue.yearly")?.licenseType,
      CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY,
    );
    assert.equal(resolveGoogleCreatorProduct("st.creators.perfilm")?.kind, "content_upload");
  });
});
