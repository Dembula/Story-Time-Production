import { LegalPage } from "@/components/legal/LegalPage";

export default function AcceptableUsePage() {
  return (
    <LegalPage
      eyebrow="Use Policy"
      title="Acceptable Use Policy"
      summary="This Policy explains the conduct standards that apply when using Story Time. It is designed to protect audiences, creators, rights holders, and the stability of the platform."
      lastUpdated="March 2026"
      highlights={["No abuse", "No scraping", "No illegal uploads"]}
      sections={[
        {
          title: "1. Lawful use only",
          content: (
            <>
              <p>
                You may use Story Time only for lawful purposes and only in ways that
                are consistent with our Terms, content policies, and service design.
              </p>
              <p>
                You may not use the platform to commit fraud, distribute unlawful
                material, deceive other users, or interfere with platform operations.
              </p>
            </>
          ),
        },
        {
          title: "2. Platform misuse is prohibited",
          content: (
            <>
              <p>
                You may not scrape, crawl, reverse engineer, automate unauthorized
                access, overload the service, probe infrastructure, harvest user data,
                or try to bypass account, role, subscription, or age-based controls.
              </p>
              <p>
                You may not create fake accounts, misuse trials, abuse payment flows,
                or use Story Time in a manner that increases fraud or chargeback risk.
              </p>
            </>
          ),
        },
        {
          title: "3. Harmful conduct and unsafe content",
          content: (
            <>
              <p>
                Story Time does not allow conduct or content that is illegal,
                defamatory, hateful, exploitative, violent in an unlawful manner,
                sexually exploitative, or harmful to minors or vulnerable persons.
              </p>
              <p>
                We may remove or limit access to material that presents platform,
                legal, copyright, safety, or community risk.
              </p>
            </>
          ),
        },
        {
          title: "4. Enforcement",
          content: (
            <>
              <p>
                Story Time may investigate suspected misuse and may issue warnings,
                remove content, restrict visibility, suspend features, terminate
                accounts, or preserve records where necessary for safety, legal, or
                operational reasons.
              </p>
              <p>
                Repeated or severe violations may lead to permanent loss of access.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
