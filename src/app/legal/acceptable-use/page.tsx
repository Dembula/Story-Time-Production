import { LegalPage } from "@/components/legal/LegalPage";

export default function AcceptableUsePage() {
  return (
    <LegalPage
      eyebrow="Use Policy"
      title="Acceptable Use Policy"
      summary="This Acceptable Use Policy (“AUP”) sets conduct standards for anyone using Story Time, operated by STORYTIME STUDIOS (Pty) Ltd. It protects audiences, creators, rights holders, payment partners, and platform stability, and complements our Terms of Service and Content Policy."
      lastUpdated="July 2026"
      highlights={["Lawful use", "No scraping", "Child safety", "Cybercrimes Act"]}
      sections={[
        {
          title: "1. Lawful use only",
          content: (
            <>
              <p>
                You may use Story Time only for lawful purposes and only in ways
                consistent with our Terms, Content Policy, and the workflows we provide.
              </p>
              <p>
                Prohibited conduct includes activity that may contravene the Cybercrimes
                Act 19 of 2020, ECTA, the Films and Publications Act, POPIA, intellectual
                property law, or any other applicable criminal or civil law.
              </p>
            </>
          ),
        },
        {
          title: "2. Platform misuse",
          content: (
            <>
              <p>You may not:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>scrape, crawl, harvest, or bulk-export data without written permission;</li>
                <li>reverse engineer, probe, or overload infrastructure;</li>
                <li>bypass account, role, subscription, payment, or age-based controls;</li>
                <li>create fake accounts, misuse trials, or abuse referral or payment flows;</li>
                <li>interfere with other users’ access or experience; or</li>
                <li>use automated bots except where we expressly allow them.</li>
              </ul>
            </>
          ),
        },
        {
          title: "3. Harmful conduct and unsafe content",
          content: (
            <>
              <p>
                You may not engage in harassment, threats, doxxing, hate speech that is
                unlawful, sexual exploitation, content that endangers minors, or any
                conduct that creates serious safety risk. Child sexual abuse material is
                strictly prohibited and will be reported to authorities.
              </p>
              <p>
                We may remove or limit access to material that presents legal, copyright,
                safety, payment, or community risk even if not every element is
                independently criminal.
              </p>
            </>
          ),
        },
        {
          title: "4. Security and credentials",
          content: (
            <>
              <p>
                You must not share account credentials in a way that compromises security,
                attempt to access another user’s account, or exploit vulnerabilities. If
                you discover a security issue, report it to support@story-time.online
                rather than publicly exploiting it.
              </p>
            </>
          ),
        },
        {
          title: "5. Enforcement",
          content: (
            <>
              <p>
                Story Time may investigate suspected misuse and may issue warnings,
                remove content, restrict visibility, suspend features, terminate
                accounts, preserve records, and cooperate with law enforcement or payment
                partners where necessary.
              </p>
              <p>
                Repeated or severe violations may lead to permanent loss of access and,
                where appropriate, civil or criminal referral.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Policy enforcement contact: support@story-time.online | +27 61 657 2691.
          Report abuse, fraud, unauthorized access attempts, or unlawful content through
          these channels.
        </p>
      }
    />
  );
}
