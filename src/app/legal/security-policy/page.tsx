import { LegalPage } from "@/components/legal/LegalPage";

export default function SecurityPolicyPage() {
  return (
    <LegalPage
      eyebrow="Security"
      title="Security Policy"
      summary="StoryTime applies layered technical and organizational controls to protect user data, payment operations, and platform integrity."
      lastUpdated="April 2026"
      highlights={["Encryption", "Access control", "Monitoring"]}
      sections={[
        {
          title: "1. Core safeguards",
          content: (
            <>
              <p>
                Security controls include encryption in transit, controlled system
                access, secure server infrastructure, environment-based access
                management, and continuous monitoring for suspicious behavior.
              </p>
            </>
          ),
        },
        {
          title: "2. Operational security",
          content: (
            <>
              <p>
                StoryTime enforces role-based access, session controls, authentication
                checks, and logging to reduce unauthorized activity and support incident
                response.
              </p>
            </>
          ),
        },
        {
          title: "3. Incident handling",
          content: (
            <>
              <p>
                Security incidents are triaged and investigated with evidence retention
                and remediation actions. Where required by law, relevant authorities and
                affected users are notified.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Security contact: support@story-time.online | +27 61 657 2691.
        </p>
      }
    />
  );
}
