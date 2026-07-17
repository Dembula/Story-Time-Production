import { LegalPage } from "@/components/legal/LegalPage";

export default function PaymentPolicyPage() {
  return (
    <LegalPage
      eyebrow="Payments"
      title="Payment Policy"
      summary="This Payment Policy explains how STORYTIME STUDIOS (Pty) Ltd (“Story Time”) processes payments for subscriptions, licenses, and other digital services. It works together with our Subscription Terms, Refund Policy, and Privacy Policy, and is designed for transparent e-commerce under the CPA and ECTA."
      lastUpdated="July 2026"
      highlights={["PayFast", "No full card storage", "CPA pricing clarity", "Apple · Play · TV billing"]}
      sections={[
        {
          title: "1. Payment processors",
          content: (
            <>
              <p>
                Web and browser payments on Story Time are processed through licensed
                payment gateway partners, primarily PayFast, and subject to applicable
                processor terms, banking rules, and card-network operating regulations.
              </p>
              <p>
                By completing a payment, you authorize Story Time and its processors to
                charge the selected payment method for the disclosed amount and any
                recurring fees you have agreed to.
              </p>
            </>
          ),
        },
        {
          title: "2. Pricing and pre-contract disclosure",
          content: (
            <>
              <p>
                Prices, currency (typically South African Rand), transaction type
                (one-time or recurring), billing cycle, and material entitlements are
                displayed before you confirm payment. We do not charge undisclosed fees.
              </p>
              <p>
                Taxes, currency conversion fees charged by your bank, or processor fees
                outside Story Time’s control may still apply according to your financial
                institution.
              </p>
            </>
          ),
        },
        {
          title: "3. Card data and security",
          content: (
            <>
              <p>
                Story Time does not intentionally store full card PAN or CVV in its
                databases. Sensitive card data is handled by PCI-DSS capable gateway
                channels using tokenization, encryption in transit, and authentication
                checks (including 3D Secure where required).
              </p>
              <p>
                Limited transaction metadata (status, masked details, reference IDs,
                dispute status) may be retained for reconciliation, fraud controls,
                support, and legal record-keeping as described in our Privacy Policy.
              </p>
            </>
          ),
        },
        {
          title: "4. Failed, pending, and duplicate charges",
          content: (
            <>
              <p>
                You are not charged for a transaction unless the gateway confirms
                successful authorization or settlement. Pending or ambiguous states
                should be reported to support with the transaction reference so we can
                investigate with the processor.
              </p>
              <p>
                If you believe you were charged twice for the same purchase, contact us
                promptly. Confirmed duplicates are corrected under our Refund Policy.
              </p>
            </>
          ),
        },
        {
          title: "5. Chargebacks and dispute prevention",
          content: (
            <>
              <p>
                Please contact Story Time support before initiating a bank or card
                chargeback. Many issues can be resolved faster through our billing team.
                Fraudulent or abusive dispute behaviour may result in account restriction
                or suspension.
              </p>
              <p>
                Where a chargeback is filed, we may submit representment evidence
                including billing records, access logs, and service-delivery records
                through our payment partner.
              </p>
            </>
          ),
        },
        {
          title: "6. App store and connected-TV billing",
          content: (
            <>
              <p>
                If digital content or subscriptions are sold inside a store-distributed
                app, billing may be handled by the platform operator rather than PayFast:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-slate-200">Apple In-App Purchase</strong> —
                  billed by Apple under Apple’s Media Services Terms and App Store rules;
                  refunds are generally handled by Apple.
                </li>
                <li>
                  <strong className="text-slate-200">Google Play Billing</strong> —
                  billed by Google under Google Play payment terms; refunds and
                  cancellations generally follow Google Play’s policies and tools.
                </li>
                <li>
                  <strong className="text-slate-200">Amazon, Samsung, LG, Roku, and other TV / OEM stores</strong>{" "}
                  — billed under that store’s commerce rules where those channels are used.
                </li>
              </ul>
              <p>
                Story Time will cooperate with store operators where reasonably requested.
                Web payments processed via PayFast remain subject to this Payment Policy
                and our Refund Policy.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Payments support: support@story-time.online | +27 61 657 2691. Include
          account email, approximate payment time, amount, gateway or store reference,
          and whether the charge came from the website, Apple, Google Play, or another
          store when contacting us.
        </p>
      }
    />
  );
}
