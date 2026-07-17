import { LegalPage } from "@/components/legal/LegalPage";

export default function RegulatoryFrameworkPage() {
  return (
    <LegalPage
      eyebrow="Compliance"
      title="Legal and Regulatory Framework"
      summary="STORYTIME STUDIOS (Pty) Ltd (“Story Time”) operates primarily under South African law and maintains governance controls across privacy, e-commerce, consumer protection, cybersecurity, payments, and access-to-information. This page also describes alignment with major app distributors—including Apple App Store, Google Play, Amazon Appstore, and connected-TV platforms."
      lastUpdated="July 2026"
      highlights={["POPIA", "ECTA", "CPA", "Google Play", "Apple 5.1", "TV platforms"]}
      sections={[
        {
          title: "1. Operator and compliance scope",
          content: (
            <>
              <p>
                Story Time is operated by STORYTIME STUDIOS (Pty) Ltd (CIPC registration
                number 2026/269060/07), a private company in the Republic of South
                Africa. Compliance controls cover personal-data processing, electronic
                contracting, payments, content moderation, child and audience safety, and
                records management across web, mobile, and connected-TV applications.
              </p>
            </>
          ),
        },
        {
          title: "2. POPIA (Protection of Personal Information Act 4 of 2013)",
          content: (
            <>
              <p>
                We process personal information lawfully and for defined purposes, apply
                purpose limitation and minimality, secure data through technical and
                organisational measures, support access and correction requests, honour
                account export and deletion controls, and maintain breach-response
                procedures. Cross-border transfers are handled with section 72
                safeguards. See our Privacy Policy.
              </p>
            </>
          ),
        },
        {
          title: "3. ECTA (Electronic Communications and Transactions Act 25 of 2002)",
          content: (
            <>
              <p>
                Electronic agreements are presented in accessible form. Service and
                pricing disclosures are provided before paid transactions. Digital
                records and communications are designed to support enforceability and
                integrity of electronic contracts.
              </p>
            </>
          ),
        },
        {
          title: "4. CPA (Consumer Protection Act 68 of 2008)",
          content: (
            <>
              <p>
                Where users are consumers, Story Time supports fair, reasonable, and
                transparent practices: clear service descriptions, transparent pricing,
                fair contract terms, and structured refund and cancellation processes.
                Non-waivable consumer rights are preserved in our Terms and Refund
                Policy.
              </p>
            </>
          ),
        },
        {
          title: "5. FICA and payment-partner obligations",
          content: (
            <>
              <p>
                For relevant payment, payout, and financial-risk scenarios, Story Time
                may perform verification checks, maintain transaction records, monitor
                suspicious activity, and cooperate with licensed financial institutions
                and processors (including PayFast). FICA-related duties apply to
                accountable institutions; Story Time supports partner compliance where
                required for platform payments and payouts.
              </p>
            </>
          ),
        },
        {
          title: "6. Cybercrimes Act 19 of 2020",
          content: (
            <>
              <p>
                We enforce cybersecurity controls, monitor unauthorized access attempts,
                preserve evidence where required, prohibit unlawful system interference,
                and may cooperate with law enforcement regarding offences committed
                through or against the platform.
              </p>
            </>
          ),
        },
        {
          title: "7. PAIA (Promotion of Access to Information Act 2 of 2000)",
          content: (
            <>
              <p>
                We maintain a PAIA request process for lawful access to company records,
                subject to statutory procedures and grounds for refusal. See our PAIA
                Manual summary.
              </p>
            </>
          ),
        },
        {
          title: "8. Films and Publications Act and content standards",
          content: (
            <>
              <p>
                Age ratings, advisories, and distribution controls are applied with
                regard to the Films and Publications Act 65 of 1996 (as amended) and
                related standards where applicable, supported by our Content Policy and
                Acceptable Use Policy.
              </p>
            </>
          ),
        },
        {
          title: "9. Companies Act 71 of 2008",
          content: (
            <>
              <p>
                STORYTIME STUDIOS (Pty) Ltd (CIPC registration number 2026/269060/07)
                operates as a private company and maintains governance and operational
                controls in line with applicable corporate requirements under the
                Companies Act 71 of 2008.
              </p>
            </>
          ),
        },
        {
          title: "10. App stores, Google Play, Apple, and connected-TV distributors",
          content: (
            <>
              <p>
                For multi-platform distribution readiness, Story Time maintains
                governance designed to align with major marketplace and device-store
                expectations:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-slate-200">Public privacy disclosures</strong> —
                  a Privacy Policy describing collection, use, sharing, retention,
                  security, and deletion, suitable for Apple App Privacy, Google Play
                  Data safety, and similar store questionnaires.
                </li>
                <li>
                  <strong className="text-slate-200">Account deletion</strong> —
                  in-product permanent account deletion and data export (Apple Guideline
                  5.1.1(v)), plus an external web / support deletion pathway for Google
                  Play User Data policy compliance (not mere account freezing).
                </li>
                <li>
                  <strong className="text-slate-200">Subscriptions and billing clarity</strong>{" "}
                  — auto-renewal, pricing, and cancellation disclosures for web (PayFast)
                  and store billing (Apple In-App Purchase, Google Play Billing, and other
                  OEM / TV stores where used).
                </li>
                <li>
                  <strong className="text-slate-200">Content and child safety</strong> —
                  Content Policy, Acceptable Use Policy, age ratings / advisories, and
                  Families-oriented design principles for store and TV catalogues.
                </li>
                <li>
                  <strong className="text-slate-200">Platform-specific privacy controls</strong>{" "}
                  — readiness for Apple App Tracking Transparency, Android advertising-ID
                  / User Data requirements, and TV or OEM privacy settings.
                </li>
                <li>
                  <strong className="text-slate-200">Distributor independence</strong> —
                  Apple, Google, Amazon, Samsung, LG, Roku, and similar distributors are
                  not parties to the Story Time user agreement for the service itself;
                  their store terms govern store accounts, device services, and
                  store-processed payments.
                </li>
              </ul>
              <p>
                Detailed operational disclosures appear in our Privacy Policy, Terms of
                Service, Subscription Terms, Payment Policy, and Refund Policy.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Compliance contact: support@story-time.online | +27 61 657 2691.
        </p>
      }
    />
  );
}
