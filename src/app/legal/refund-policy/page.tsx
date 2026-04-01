import { LegalPage } from "@/components/legal/LegalPage";

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Refunds"
      title="Refund Policy"
      summary="This Policy explains how Story Time handles refunds, billing disputes, failed charges, reversals, and chargeback risk across viewer, creator, and business payments."
      lastUpdated="April 2026"
      highlights={["Billing clarity", "Chargeback risk", "CPA aware review"]}
      sections={[
        {
          title: "1. General approach",
          content: (
            <>
              <p>
                Story Time reviews refund requests in line with applicable law, the
                product purchased, platform records, and whether the relevant service or
                access was actually made available.
              </p>
              <p>
                Not every charge is automatically refundable. We may decline refunds
                where access was used, where a policy breach occurred, or where the
                request is inconsistent with the relevant plan terms.
              </p>
              <p>
                Refund outcomes are assessed with reference to applicable law, including
                relevant CPA protections and card-network operating rules that apply to
                the transaction type.
              </p>
            </>
          ),
        },
        {
          title: "2. Viewer subscriptions",
          content: (
            <>
              <p>
                Refund requests for viewer subscriptions may be considered where a user
                was incorrectly billed, charged more than once for the same period, or
                unable to access the subscribed service because of a platform-side
                failure.
              </p>
              <p>
                If a free trial is offered, conversion to a paid plan after the stated
                trial period is treated as a standard subscription charge unless the
                law requires otherwise.
              </p>
            </>
          ),
        },
        {
          title: "3. Creator, license, and business-plan charges",
          content: (
            <>
              <p>
                Distribution-license fees, listing-plan charges, workflow purchases, or
                similar business-related fees are generally assessed according to the
                value unlocked in the platform, the timing of use, and whether the
                related functionality or visibility has already been provisioned.
              </p>
              <p>
                If a purchase enabled an upload right, listing tier, or workflow
                action, refund treatment may differ from standard consumer streaming
                access.
              </p>
            </>
          ),
        },
        {
          title: "4. Fraud, abuse, and chargebacks",
          content: (
            <>
              <p>
                Story Time may refuse refunds where we believe the request is linked to
                fraud, account abuse, payment misuse, repeated chargeback activity, or
                a deliberate attempt to use the service without paying for it.
              </p>
              <p>
                We may retain transaction, sign-in, and usage records where necessary
                to investigate and respond to a billing dispute or chargeback.
              </p>
              <p>
                Where chargebacks are initiated, Story Time may submit representment
                evidence including billing records, access logs, authentication signals,
                and service-delivery records through its payment gateway partner.
              </p>
            </>
          ),
        },
        {
          title: "5. How requests are reviewed",
          content: (
            <>
              <p>
                Refund and billing-dispute requests are reviewed against account,
                subscription, and transaction records, plus any evidence of platform
                use, content access, or feature activation.
              </p>
              <p>
                Story Time may update this Policy as payment operations evolve or as
                legal and card-network requirements change.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Refunds and billing disputes contact: support@story-time.online | +27 61
          657 2691. Please include account email, transaction reference, payment date,
          and reason for your request to support timely review.
        </p>
      }
    />
  );
}
