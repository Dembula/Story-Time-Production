import { LegalPage } from "@/components/legal/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      summary="These Terms explain how Story Time may be used by viewers, creators, partners, and administrators. They cover access, content ownership, subscriptions, enforcement, payment processing, and legal rights under South African law."
      lastUpdated="April 2026"
      highlights={["South Africa", "Consumer Protection Act", "ECTA", "Content ownership"]}
      sections={[
        {
          title: "1. Who these Terms apply to",
          content: (
            <>
              <p>
                These Terms apply to anyone who accesses Story Time, including viewers,
                creators, music contributors, equipment companies, location owners,
                crew teams, casting agencies, and catering providers.
              </p>
              <p>
                By creating an account, browsing the service, uploading material, or
                using any paid plan, you agree to these Terms together with our Privacy
                Policy, Subscription Terms, Refund Policy, Content Policy, Copyright
                Notice, Cookie Policy, and Acceptable Use Policy.
              </p>
              <p>
                These Terms are interpreted in line with applicable South African law,
                including the Electronic Communications and Transactions Act 25 of 2002
                (&quot;ECTA&quot;), the Consumer Protection Act 68 of 2008 (&quot;CPA&quot;),
                the Protection of Personal Information Act 4 of 2013 (&quot;POPIA&quot;),
                and the Cybercrimes Act 19 of 2020.
              </p>
            </>
          ),
        },
        {
          title: "2. Accounts, access, and security",
          content: (
            <>
              <p>
                You must provide accurate registration information and keep your login
                credentials confidential. You are responsible for activity that takes
                place through your account unless you promptly notify Story Time of
                unauthorized access.
              </p>
              <p>
                Story Time uses authenticated account access, session controls,
                role-based permissions, and activity logging to protect the platform.
                We may suspend access where we detect abuse, fraud risk, suspicious
                behavior, or a breach of platform rules.
              </p>
            </>
          ),
        },
        {
          title: "3. What users may and may not do",
          content: (
            <>
              <p>
                You may use Story Time only for lawful purposes and in line with the
                workflows the platform provides for streaming, uploading, licensing,
                discovery, production management, and collaboration.
              </p>
              <p>
                You may not upload unlawful or infringing material, impersonate others,
                bypass age or subscription controls, scrape or overload the service,
                attempt unauthorized access, interfere with platform operations, or use
                Story Time to promote harmful, fraudulent, or abusive conduct.
              </p>
            </>
          ),
        },
        {
          title: "4. Content ownership and platform rights",
          content: (
            <>
              <p>
                Creators retain ownership of the content they submit, subject to any
                rights already granted to collaborators, licensors, or third parties.
                You may upload only content you own or are authorized to use.
              </p>
              <p>
                By uploading or submitting material to Story Time, you grant us the
                limited rights needed to host, store, process, review, stream, display,
                distribute, promote, and administer that material within the platform
                and its business operations.
              </p>
              <p>
                Story Time may review submissions, metadata, age ratings, advisories,
                and related account activity before public publication or continued
                availability.
              </p>
            </>
          ),
        },
        {
          title: "5. Payments, subscriptions, and platform economics",
          content: (
            <>
              <p>
                Certain features require a paid plan or platform fee. Viewer
                subscriptions unlock streaming access, while creator and company tools
                may require distribution or listing licenses.
              </p>
              <p>
                Pricing, billing terms, plan effects, and eligibility rules are
                described in the relevant subscription and product flows. You authorize
                Story Time to charge applicable fees for the plan, license, or service
                you choose.
              </p>
              <p>
                Payments may be processed through licensed third-party payment gateway
                providers using tokenized card processing, 3D Secure authentication
                where required, transaction risk checks, and card-network dispute
                workflows. Story Time does not intentionally store full card PAN or CVV
                in platform databases.
              </p>
              <p>
                Revenue participation, creator economics, or business benefits may
                depend on the product structure, audience activity, licensing status,
                platform rules, and any additional agreements that apply to your role.
              </p>
            </>
          ),
        },
        {
          title: "6. Enforcement, moderation, and takedowns",
          content: (
            <>
              <p>
                We may remove content, restrict visibility, reject submissions, pause
                distribution, or suspend or terminate accounts where we believe a user
                has violated these Terms, our policies, or the law.
              </p>
              <p>
                Story Time may also respond to valid copyright notices, legal process,
                platform safety concerns, moderation findings, and repeated policy
                violations.
              </p>
            </>
          ),
        },
        {
          title: "7. Liability and service availability",
          content: (
            <>
              <p>
                Story Time is provided on an &quot;as available&quot; basis. We work to
                maintain platform quality and reliability, but we do not guarantee that
                the service will always be uninterrupted, error-free, or suitable for
                every purpose.
              </p>
              <p>
                To the maximum extent permitted by law, Story Time is not liable for
                indirect, incidental, consequential, or special loss arising from use
                of the platform, user-generated content, third-party actions, or
                service interruptions.
              </p>
            </>
          ),
        },
        {
          title: "8. Governing law",
          content: (
            <>
              <p>
                These Terms are governed by the laws of South Africa, subject to any
                mandatory consumer protections that may apply in your jurisdiction.
              </p>
              <p>
                If any part of these Terms is unenforceable, the remaining provisions
                will continue to apply.
              </p>
              <p>
                To the extent required by the CPA, nothing in these Terms is intended
                to waive non-waivable consumer rights, including fair and reasonable
                terms (sections 48 and 49), plain language disclosure (section 22), and
                rights linked to service performance (section 54).
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Official legal and operational contact: support@story-time.online | +27
          61 657 2691. For legal notices, billing disputes, policy questions, or
          escalation requests, contact Story Time through these channels.
        </p>
      }
    />
  );
}
