import { LegalPage } from "@/components/legal/LegalPage";

export default function SubscriptionTermsPage() {
  return (
    <LegalPage
      eyebrow="Billing"
      title="Subscription Terms"
      summary="These terms explain how Story Time structures viewer subscriptions, creator distribution licensing, and company listing plans, including billing authorization, renewals, payment gateway processing, and dispute handling."
      lastUpdated="April 2026"
      highlights={["ZAR pricing", "Access gating", "Role-based plans", "Gateway processing"]}
      sections={[
        {
          title: "1. Viewer subscriptions",
          content: (
            <>
              <p>
                Story Time may offer viewer plans that unlock streaming access to the
                catalogue. Available plan structures and pricing are shown in the
                relevant product flow at the time of purchase.
              </p>
              <p>
                Access to browse and watch features may be limited if a valid viewer
                subscription is not active.
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
                Certain plan levels may change functionality or visibility within the
                platform, including catalog access or marketplace placement.
              </p>
            </>
          ),
        },
        {
          title: "3. Billing authorization",
          content: (
            <>
              <p>
                By starting a paid plan, you authorize Story Time to apply the
                disclosed charges for your selected plan, license, or service in the
                manner presented during checkout or account setup.
              </p>
              <p>
                Fees are generally denominated in South African Rand unless we clearly
                state otherwise.
              </p>
              <p>
                Payments may be processed by PCI-DSS capable payment gateway partners.
                For card payments, tokenization, payment authentication (including 3D
                Secure where required), and gateway fraud-screening controls may apply.
              </p>
            </>
          ),
        },
        {
          title: "4. Renewals, access, and plan changes",
          content: (
            <>
              <p>
                If a plan is recurring, it may renew according to the schedule shown at
                signup unless paused, canceled, expired, or otherwise ended under the
                applicable product rules.
              </p>
              <p>
                Story Time may change pricing, packaging, or entitlements for future
                billing periods by updating the relevant purchase flow and legal
                materials.
              </p>
              <p>
                Material billing changes are communicated in advance where required by
                applicable law, including CPA fair-notice expectations and ECTA
                disclosure principles.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Billing and subscription contact: support@story-time.online | +27 61 657
          2691. Refund eligibility, disputes, and chargebacks are governed with the
          Refund Policy and applicable consumer protections under South African law.
        </p>
      }
    />
  );
}
