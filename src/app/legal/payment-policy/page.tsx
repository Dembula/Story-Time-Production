import { LegalPage } from "@/components/legal/LegalPage";

export default function PaymentPolicyPage() {
  return (
    <LegalPage
      eyebrow="Payments"
      title="Payment Policy"
      summary="StoryTime processes transactions through secure third-party payment infrastructure with pricing transparency, gateway security controls, and dispute governance."
      lastUpdated="April 2026"
      highlights={["Paystack", "Secure gateway", "Chargeback controls"]}
      sections={[
        {
          title: "1. Payment processing",
          content: (
            <>
              <p>
                All payments on StoryTime are processed through Paystack as an external
                payment gateway. Users are subject to applicable processor terms and
                banking/card-network rules.
              </p>
            </>
          ),
        },
        {
          title: "2. Pricing and transaction disclosure",
          content: (
            <>
              <p>
                Prices are displayed before payment confirmation. Transaction type,
                billing cycle, and recurring-charge details are shown prior to checkout
                where applicable.
              </p>
            </>
          ),
        },
        {
          title: "3. Data handling and security",
          content: (
            <>
              <p>
                StoryTime does not intentionally store sensitive full card data (such
                as PAN/CVV). Payment data is processed via secure gateway channels and
                associated risk controls such as tokenization and authentication checks.
              </p>
            </>
          ),
        },
        {
          title: "4. Failed transactions",
          content: (
            <>
              <p>
                Users are not charged for unsuccessful transactions unless the gateway
                confirms successful capture or settlement. Where uncertainty exists,
                users should contact support with transaction references for review.
              </p>
            </>
          ),
        },
        {
          title: "5. Chargebacks and misuse",
          content: (
            <>
              <p>
                Users are encouraged to contact StoryTime support before initiating
                chargebacks. Fraudulent or abusive dispute behavior may result in
                account restrictions, suspension, or legal escalation.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Payments support: support@story-time.online | +27 61 657 2691.
        </p>
      }
    />
  );
}
