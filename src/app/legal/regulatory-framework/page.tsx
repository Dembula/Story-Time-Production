import { LegalPage } from "@/components/legal/LegalPage";

export default function RegulatoryFrameworkPage() {
  return (
    <LegalPage
      eyebrow="Compliance"
      title="Legal and Regulatory Framework"
      summary="StoryTime (Pty) Ltd operates in compliance with South African law and maintains governance controls across privacy, transactions, cybersecurity, consumer protection, and access-to-information obligations."
      lastUpdated="April 2026"
      highlights={["POPIA", "ECTA", "CPA", "FICA", "Cybercrimes Act", "PAIA"]}
      sections={[
        {
          title: "1. Applicable laws and compliance scope",
          content: (
            <>
              <p>
                StoryTime (Pty) Ltd operates in the Republic of South Africa and applies
                legal controls in line with platform operations, including personal data
                processing, e-commerce, payments, moderation, and records management.
              </p>
            </>
          ),
        },
        {
          title: "2. POPIA (Protection of Personal Information Act 4 of 2013)",
          content: (
            <>
              <p>
                StoryTime processes personal information lawfully and for defined
                purposes, obtains informed consent where required, secures data through
                technical and organizational controls, supports lawful access/correction
                requests, and applies breach response procedures.
              </p>
            </>
          ),
        },
        {
          title: "3. ECTA (Electronic Communications and Transactions Act 25 of 2002)",
          content: (
            <>
              <p>
                Electronic agreements are presented in accessible form, service and
                pricing disclosures are provided, and digital transaction flows are
                designed for enforceability, record integrity, and secure
                communications.
              </p>
            </>
          ),
        },
        {
          title: "4. CPA (Consumer Protection Act 68 of 2008)",
          content: (
            <>
              <p>
                StoryTime supports fair, reasonable, and transparent consumer practices,
                including clear service descriptions, transparent pricing, and
                structured refund and cancellation processes.
              </p>
            </>
          ),
        },
        {
          title: "5. FICA (Financial Intelligence Centre Act 38 of 2001)",
          content: (
            <>
              <p>
                For relevant payment and financial-risk scenarios, StoryTime may perform
                verification checks, maintain transaction records, monitor suspicious
                activity signals, and cooperate with licensed financial institutions and
                processors.
              </p>
            </>
          ),
        },
        {
          title: "6. Cybercrimes Act 19 of 2020",
          content: (
            <>
              <p>
                StoryTime enforces cybersecurity controls, monitors unauthorized access
                attempts, preserves evidence where required, and may cooperate with law
                enforcement for unlawful platform activity.
              </p>
            </>
          ),
        },
        {
          title: "7. PAIA (Promotion of Access to Information Act 2 of 2000)",
          content: (
            <>
              <p>
                StoryTime maintains a PAIA process for lawful requests to access records
                held by the company, subject to statutory procedures, eligibility, and
                lawful limitations.
              </p>
            </>
          ),
        },
        {
          title: "8. Companies Act 71 of 2008",
          content: (
            <>
              <p>
                StoryTime operates as a private company and maintains governance and
                operational controls in line with applicable corporate requirements.
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
