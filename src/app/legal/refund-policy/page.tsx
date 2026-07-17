import { LegalPage } from "@/components/legal/LegalPage";

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Refunds"
      title="Refund and Cancellation Policy"
      summary="This Policy explains how STORYTIME STUDIOS (Pty) Ltd (“Story Time”) handles cancellations, refunds, billing disputes, failed charges, and chargebacks. It is applied with regard to the Consumer Protection Act 68 of 2008 (“CPA”) where you are a consumer, and with card-network and payment-partner rules."
      lastUpdated="July 2026"
      highlights={["CPA aware", "Cancel anytime", "Fair review", "Apple · Play refunds"]}
      sections={[
        {
          title: "1. Cancellation of subscriptions",
          content: (
            <>
              <p>
                You may cancel a recurring Story Time subscription at any time through
                your account billing settings (or through Apple / Google Play /
                other-store subscription management for store-billed plans). Cancellation
                stops future renewals; it does not automatically refund the current paid
                period unless this Policy or applicable law requires otherwise.
              </p>
              <p>
                Access typically continues until the end of the already-paid billing
                period after cancellation.
              </p>
            </>
          ),
        },
        {
          title: "2. General refund approach",
          content: (
            <>
              <p>
                Digital content and subscriptions are generally non-refundable once
                access has been provisioned, except where:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>you were incorrectly billed or charged more than once;</li>
                <li>platform-side failure prevented access you paid for;</li>
                <li>a cooling-off or other mandatory consumer right applies under the CPA or other law; or</li>
                <li>we expressly offered a refundable trial or guarantee in writing.</li>
              </ul>
              <p>
                We review each request against account, subscription, and usage records.
                Outcomes may differ for viewer streaming plans versus creator or business
                licenses.
              </p>
            </>
          ),
        },
        {
          title: "3. Viewer subscriptions",
          content: (
            <>
              <p>
                Refund requests for viewer subscriptions are most likely to be approved
                where billing error, duplicate charge, or verified platform failure
                prevented contracted access.
              </p>
              <p>
                Heavy use of the catalogue during the billing period, or a change of
                mind after substantial viewing, typically does not create an automatic
                refund entitlement, subject always to mandatory consumer protections.
              </p>
            </>
          ),
        },
        {
          title: "4. Creator, license, and business-plan charges",
          content: (
            <>
              <p>
                Distribution licenses, listing plans, workflow purchases, and similar
                business fees are assessed according to the value unlocked, timing of
                use, and whether functionality or visibility has already been
                provisioned. Once an upload right, listing tier, or paid workflow has
                been activated, refunds may be limited.
              </p>
            </>
          ),
        },
        {
          title: "5. Apple, Google Play, and other store refunds",
          content: (
            <>
              <p>
                Purchases billed by Apple through In-App Purchase are generally refunded
                by Apple under Apple’s policies. Request those refunds via Apple’s report
                a problem / purchase history tools.
              </p>
              <p>
                Purchases billed by Google through Google Play Billing are generally
                refunded by Google under Google Play’s refund policies. Request those
                refunds through Google Play order history or Google’s refund tools.
              </p>
              <p>
                Purchases billed by Amazon, Samsung, LG, Roku, or another TV / OEM store
                should be refunded through that store’s support or order tools. Story Time
                will cooperate with store operators where reasonably requested and where
                we are legally required to assist.
              </p>
            </>
          ),
        },
        {
          title: "6. Fraud, abuse, and chargebacks",
          content: (
            <>
              <p>
                We may refuse refunds linked to fraud, account abuse, payment misuse,
                repeated chargeback activity, or attempts to obtain paid access without
                paying. We may retain transaction and usage records needed to
                investigate disputes.
              </p>
              <p>
                Please contact support before filing a chargeback. Unwarranted
                chargebacks may lead to account restrictions.
              </p>
            </>
          ),
        },
        {
          title: "7. How to request a refund",
          content: (
            <>
              <p>
                Email support@story-time.online or call +27 61 657 2691 with your account
                email, transaction reference, payment date, amount, and reason. We aim to
                acknowledge requests promptly and complete review within a reasonable
                period after receiving the information needed.
              </p>
              <p>
                Approved refunds are returned to the original payment method where the
                processor allows, subject to banking timelines.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Refunds and billing disputes: support@story-time.online | +27 61 657
          2691. Please include account email, transaction reference, payment date, and
          reason for your request.
        </p>
      }
    />
  );
}
