import { LegalPage } from "@/components/legal/LegalPage";

export default function RegulatoryFrameworkPage() {
  return (
    <LegalPage
      eyebrow="Compliance"
      title="Legal and Regulatory Framework"
      summary="STORYTIME STUDIOS (Pty) Ltd (“Story Time”) operates primarily under South African law and maintains governance controls across privacy, e-commerce, consumer protection, cybersecurity, payments, and access-to-information. This page also notes alignment with Apple App Store privacy and content expectations for digital distribution."
      lastUpdated="July 2026"
      highlights={["POPIA", "ECTA", "CPA", "PAIA", "Apple 5.1", "Cybercrimes Act"]}
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
                records management across web and any mobile applications.
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
          title: "10. Apple App Store and platform-partner expectations",
          content: (
            <>
              <p>
                For App Store distribution readiness, Story Time maintains:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>a publicly accessible Privacy Policy describing collection, use, sharing, retention, and deletion;</li>
                <li>in-product account data export and permanent account deletion (Guideline 5.1.1(v));</li>
                <li>clear subscription auto-renewal and cancellation disclosures;</li>
                <li>content and child-safety rules aligned with store content standards; and</li>
                <li>App Tracking Transparency readiness for any future cross-app tracking on iOS.</li>
              </ul>
              <p>
                Web payments via PayFast and any future Apple In-App Purchases are
                disclosed in our Payment and Subscription Terms.
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
