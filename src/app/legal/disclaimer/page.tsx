import { LegalPage } from "@/components/legal/LegalPage";

export default function DisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Disclaimer"
      title="Disclaimer"
      summary="This Disclaimer clarifies the limits of warranties and liability for the Story Time platform operated by STORYTIME STUDIOS (Pty) Ltd. It is subject to non-waivable rights under the Consumer Protection Act and other mandatory law."
      lastUpdated="July 2026"
      highlights={["As-is / as-available", "UGC responsibility", "CPA preserved"]}
      sections={[
        {
          title: "1. Platform availability",
          content: (
            <>
              <p>
                Story Time is provided on an “as is” and “as available” basis. We do not
                guarantee uninterrupted operation, error-free performance, or continuous
                availability. Service may be affected by maintenance, third-party
                outages, network conditions, force majeure, or security events.
              </p>
            </>
          ),
        },
        {
          title: "2. User-generated and third-party content",
          content: (
            <>
              <p>
                Content uploaded by creators and other users reflects their views and
                responsibility. Story Time does not warrant the accuracy, legality,
                completeness, or quality of user-generated content, even where moderation
                or review steps are used.
              </p>
              <p>
                Links or integrations with third-party services are provided for
                convenience. We are not responsible for third-party sites, products, or
                policies.
              </p>
            </>
          ),
        },
        {
          title: "3. Professional and entertainment use",
          content: (
            <>
              <p>
                Story Time is an entertainment and production-support platform. Unless
                expressly agreed in a separate written contract, content and tools are
                not a substitute for professional legal, financial, medical, or other
                advice.
              </p>
            </>
          ),
        },
        {
          title: "4. Limitation framework",
          content: (
            <>
              <p>
                To the maximum extent permitted by law, STORYTIME STUDIOS (Pty) Ltd
                excludes liability for indirect, incidental, special, consequential, or
                punitive loss, and for loss of profits, data, goodwill, or business
                opportunity arising from use of the platform.
              </p>
              <p>
                Nothing in this Disclaimer limits rights or remedies that cannot lawfully
                be excluded under South African consumer law or other mandatory
                legislation, including liability for gross negligence where exclusion is
                prohibited.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          General legal contact: support@story-time.online | +27 61 657 2691.
        </p>
      }
    />
  );
}
