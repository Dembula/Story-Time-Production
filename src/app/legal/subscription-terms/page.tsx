import { LegalPage } from "@/components/legal/LegalPage";

export default function SubscriptionTermsPage() {
  return (
    <LegalPage
      eyebrow="Billing"
      title="Subscription Terms"
      summary="These Subscription Terms explain how STORYTIME STUDIOS (Pty) Ltd (“Story Time”) structures viewer subscriptions, creator distribution licenses, and company listing plans—including billing authorization, renewals, cancellation, and store-specific rules for Apple App Store purchases."
      lastUpdated="July 2026"
      highlights={["ZAR pricing", "Auto-renewal disclosed", "Cancel anytime", "Apple IAP"]}
      sections={[
        {
          title: "1. Viewer subscriptions",
          content: (
            <>
              <p>
                Story Time may offer viewer plans that unlock streaming access to all or
                part of the catalogue. Plan names, prices, billing periods, and included
                entitlements are shown in the purchase flow at the time of signup.
              </p>
              <p>
                Access to browse and watch premium features may be limited if a valid
                subscription is not active. Free or promotional tiers, if offered, are
                described separately in the product UI.
              </p>
            </>
          ),
        },
        {
          title: "2. Creator and business platform fees",
          content: (
            <>
              <p>
                Creator distribution workflows and company marketplace visibility may
                require separate licenses or plan fees. These may include recurring
                licenses, per-upload charges, or tiered listing options.
              </p>
              <p>
                Plan level may affect functionality, catalogue placement, or marketplace
                visibility as disclosed at purchase.
              </p>
            </>
          ),
        },
        {
          title: "3. Billing authorization and auto-renewal",
          content: (
            <>
              <p>
                By starting a paid plan, you authorize Story Time (or Apple, for App
                Store–billed plans) to charge the disclosed price for each billing period
                until you cancel.
              </p>
              <p>
                Recurring plans renew automatically at the end of each period unless
                cancelled before renewal. Renewal price and period match what was
                disclosed at signup unless we notify you of a change for future periods
                as required by law.
              </p>
              <p>
                Fees are generally denominated in South African Rand (ZAR) unless clearly
                stated otherwise. Web card payments may use tokenization, 3D Secure, and
                gateway fraud screening.
              </p>
            </>
          ),
        },
        {
          title: "4. Cancellation and plan changes",
          content: (
            <>
              <p>
                You may cancel auto-renewal at any time through account billing settings.
                For subscriptions purchased via Apple, manage or cancel in your Apple ID
                subscription settings. Cancellation takes effect at the end of the
                current paid period unless otherwise required by law.
              </p>
              <p>
                Story Time may change pricing, packaging, or entitlements for future
                billing periods by updating the purchase flow and legal materials.
                Material changes are communicated in advance where required by the CPA
                and ECTA.
              </p>
            </>
          ),
        },
        {
          title: "5. Apple App Store subscriptions",
          content: (
            <>
              <p>
                If you subscribe through a native iOS app using Apple In-App Purchase:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>payment is charged to your Apple ID account;</li>
                <li>subscription renews automatically unless cancelled at least 24 hours before the end of the current period (or as Apple otherwise specifies);</li>
                <li>your Apple account will be charged for renewal within 24 hours prior to the end of the current period; and</li>
                <li>you can manage and cancel subscriptions in Apple ID settings after purchase.</li>
              </ul>
              <p>
                Apple’s Media Services Terms and App Store refund rules apply to those
                transactions in addition to these Subscription Terms.
              </p>
            </>
          ),
        },
        {
          title: "6. Non-payment and access",
          content: (
            <>
              <p>
                If a renewal payment fails, we may retry billing, notify you, and
                suspend premium access until payment succeeds or the plan ends. Fraud
                controls may also limit access where payment risk is detected.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Billing and subscription contact: support@story-time.online | +27 61 657
          2691. Refund eligibility and chargebacks are governed by the Refund Policy
          and applicable South African consumer protections.
        </p>
      }
    />
  );
}
