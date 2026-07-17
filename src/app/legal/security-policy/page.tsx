import { LegalPage } from "@/components/legal/LegalPage";

export default function SecurityPolicyPage() {
  return (
    <LegalPage
      eyebrow="Security"
      title="Security Policy"
      summary="STORYTIME STUDIOS (Pty) Ltd (“Story Time”) applies layered technical and organisational controls to protect user data, payment operations, and platform integrity, consistent with POPIA safeguard duties and industry practice expected by payment and app-store partners."
      lastUpdated="July 2026"
      highlights={["Encryption in transit", "Access control", "Incident response", "Vendor diligence"]}
      sections={[
        {
          title: "1. Core technical safeguards",
          content: (
            <>
              <p>
                Security controls include encryption of data in transit (TLS), controlled
                system access, secure cloud infrastructure, environment-separated
                secrets, and monitoring for suspicious behaviour.
              </p>
              <p>
                Payment card data is processed through PCI-DSS capable gateways. Story
                Time does not intentionally store full card PAN or CVV.
              </p>
            </>
          ),
        },
        {
          title: "2. Access management and operations",
          content: (
            <>
              <p>
                We enforce authentication checks, session controls, role-based
                permissions, least-privilege access for staff and systems, and logging
                to support detection and investigation of unauthorized activity.
              </p>
              <p>
                Service providers that process personal information are expected to
                apply contractual and operational safeguards appropriate to the risk.
              </p>
            </>
          ),
        },
        {
          title: "3. Application and account security",
          content: (
            <>
              <p>
                Account passwords are stored using modern hashing where credentials are
                used. OAuth providers (including Sign in with Apple and Google where
                enabled) are integrated according to provider requirements. Users should
                protect their devices and enable available account protections.
              </p>
            </>
          ),
        },
        {
          title: "4. Incident handling and notification",
          content: (
            <>
              <p>
                Security incidents are triaged, investigated, contained, and remediated.
                Evidence may be retained as needed for investigation and legal
                compliance. Where POPIA or other law requires, we notify the Information
                Regulator and affected data subjects of a compromise of personal
                information.
              </p>
            </>
          ),
        },
        {
          title: "5. Responsible disclosure",
          content: (
            <>
              <p>
                If you believe you have found a vulnerability, email
                support@story-time.online with sufficient detail to reproduce the issue.
                Do not access other users’ data, destroy systems, or publicly disclose
                the issue before we have had a reasonable opportunity to investigate.
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
