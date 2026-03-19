import { LegalPage } from "@/components/legal/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="This Policy explains what information Story Time collects, how it is used, how long it may be kept, and the safeguards we apply while operating the platform."
      lastUpdated="March 2026"
      highlights={["POPIA aware", "Account data", "Usage data"]}
      sections={[
        {
          title: "1. Information we collect",
          content: (
            <>
              <p>
                Story Time collects information you provide directly, such as account
                registration details, profile information, creator submissions,
                business listing information, project data, messages, and other content
                you enter into the platform.
              </p>
              <p>
                We also collect operational data such as sign-in activity, device or
                browser details, IP-related logs, cookie data, subscription records,
                billing metadata, usage analytics, and platform interactions that help
                us secure and improve the service.
              </p>
            </>
          ),
        },
        {
          title: "2. How we use personal information",
          content: (
            <>
              <p>
                We use information to create and manage accounts, authenticate users,
                assign roles, enable viewer profiles, gate access to age-restricted or
                subscription-only content, process creator and platform workflows, and
                operate moderation and review systems.
              </p>
              <p>
                We may also use personal information for security monitoring, fraud
                prevention, service analytics, policy enforcement, legal compliance,
                internal support, and business administration.
              </p>
            </>
          ),
        },
        {
          title: "3. Sharing and service providers",
          content: (
            <>
              <p>
                Story Time may share information with hosting providers, infrastructure
                partners, storage services, analytics tools, authentication providers,
                and payment-related vendors where necessary to operate the platform.
              </p>
              <p>
                We may also disclose information when required by law, when responding
                to valid legal requests, or when needed to protect the platform, our
                users, rights holders, or the public.
              </p>
            </>
          ),
        },
        {
          title: "4. Cookies, sessions, and profile controls",
          content: (
            <>
              <p>
                Story Time uses cookies and similar technologies to keep users signed
                in, maintain session state, remember viewer profile selection, improve
                account security, and understand how the platform is being used.
              </p>
              <p>
                Some functionality may not work properly if cookies are disabled,
                especially features related to authentication, profile management, and
                personalized viewing access.
              </p>
            </>
          ),
        },
        {
          title: "5. Data retention",
          content: (
            <>
              <p>
                We retain information for as long as reasonably necessary to provide
                the service, meet legal and accounting obligations, resolve disputes,
                investigate abuse, maintain business records, and enforce our
                agreements.
              </p>
              <p>
                Retention periods may differ depending on the type of account, content,
                transaction record, moderation history, or security event involved.
              </p>
            </>
          ),
        },
        {
          title: "6. Your rights",
          content: (
            <>
              <p>
                Subject to applicable law, including POPIA where relevant, you may have
                the right to request access to personal information, ask for correction
                of inaccurate records, object to certain processing, or request
                deletion where retention is no longer required.
              </p>
              <p>
                We may need to retain some records where required for legal, safety,
                fraud, tax, audit, or operational reasons.
              </p>
            </>
          ),
        },
        {
          title: "7. Security safeguards",
          content: (
            <>
              <p>
                Story Time uses authentication controls, session management,
                role-based access restrictions, infrastructure monitoring, and internal
                review workflows to help protect personal information and platform
                operations.
              </p>
              <p>
                No online system is completely risk-free, so you should use strong
                passwords, protect your devices, and sign out of shared systems when
                appropriate.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Story Time will publish formal privacy-contact and information-officer
          details before full commercial rollout. Until then, this policy should be
          read together with our Terms, Cookie Policy, and the rest of the legal suite.
        </p>
      }
    />
  );
}
