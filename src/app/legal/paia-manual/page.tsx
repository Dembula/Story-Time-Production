import { LegalPage } from "@/components/legal/LegalPage";

export default function PaiaManualPage() {
  return (
    <LegalPage
      eyebrow="Access to Information"
      title="PAIA Manual (Summary)"
      summary="This summary explains how STORYTIME STUDIOS (Pty) Ltd (“Story Time”) handles requests for access to records under the Promotion of Access to Information Act 2 of 2000 (“PAIA”), read with POPIA. It is provided for transparency and does not replace any formal PAIA manual lodged where required by regulation."
      lastUpdated="July 2026"
      highlights={["PAIA", "POPIA overlap", "Request process", "Lawful limits"]}
      sections={[
        {
          title: "1. Introduction and contact particulars",
          content: (
            <>
              <p>
                STORYTIME STUDIOS (Pty) Ltd (CIPC registration number 2026/269060/07)
                operates the Story Time platform and holds operational, commercial, and
                personal-information records in the ordinary course of business.
              </p>
              <p>
                PAIA and data-subject requests may be directed to:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Email: support@story-time.online</li>
                <li>Phone: +27 61 657 2691</li>
              </ul>
            </>
          ),
        },
        {
          title: "2. How to submit a request",
          content: (
            <>
              <p>Requests should include:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>full name and contact details of the requester;</li>
                <li>sufficient identity verification information;</li>
                <li>a clear description of the records sought;</li>
                <li>the form of access preferred (e.g. copy or inspection); and</li>
                <li>the lawful basis or reason for requesting access where relevant.</li>
              </ul>
              <p>
                Incomplete requests may be delayed until we receive the information
                reasonably needed to process them.
              </p>
            </>
          ),
        },
        {
          title: "3. Processing, fees, and timelines",
          content: (
            <>
              <p>
                We review requests in line with statutory timelines, identity
                verification requirements, and lawful grounds for access, refusal, or
                partial disclosure. Prescribed PAIA fees may apply where the Act allows.
              </p>
              <p>
                Data-subject access requests under POPIA (sections 23–25) may be handled
                through the same contact channels and, for signed-in users, complemented
                by in-product data export tools described in our Privacy Policy.
              </p>
            </>
          ),
        },
        {
          title: "4. Categories of records (overview)",
          content: (
            <>
              <p>
                Records may include company incorporation and governance documents,
                contracts with vendors and creators, user account and transaction
                records, content moderation logs, security logs, and correspondence.
                Availability of any specific record is subject to PAIA grounds for
                refusal and POPIA limitations.
              </p>
            </>
          ),
        },
        {
          title: "5. Grounds for refusal or limitation",
          content: (
            <>
              <p>
                Access may be refused or limited where records contain protected personal
                information of third parties, confidential commercial information,
                privileged content, security-sensitive data, or where disclosure is
                otherwise restricted by PAIA, POPIA, or other law.
              </p>
            </>
          ),
        },
        {
          title: "6. Remedies",
          content: (
            <>
              <p>
                If you are dissatisfied with a PAIA decision, you may use internal
                escalation via the contact details above and, where the Act provides,
                pursue remedies through the Information Regulator or the courts.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          PAIA requests contact: support@story-time.online | +27 61 657 2691.
        </p>
      }
    />
  );
}
