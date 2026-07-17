import { LegalPage } from "@/components/legal/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      summary="These Terms of Service (“Terms”) form a binding agreement between you and STORYTIME STUDIOS (Pty) Ltd (CIPC registration number 2026/269060/07) (“Story Time”, “we”, “us”, or “our”) governing access to and use of the Story Time platform. They should be read with our Privacy Policy, Subscription Terms, Payment Policy, Refund Policy, Content Policy, Cookie Policy, Acceptable Use Policy, and Copyright Notice."
      lastUpdated="July 2026"
      highlights={["South Africa", "CPA & ECTA", "Apple · Google Play · TV", "Account deletion"]}
      sections={[
        {
          title: "1. Acceptance of these Terms",
          content: (
            <>
              <p>
                By creating an account, browsing the service, uploading material,
                purchasing a plan, or otherwise using Story Time, you agree to these
                Terms and the related policies listed above. If you do not agree, do not
                use the service.
              </p>
              <p>
                Electronic contracts and notices on Story Time are intended to be valid
                under the Electronic Communications and Transactions Act 25 of 2002
                (“ECTA”). Plain-language disclosures and fair-contract standards under
                the Consumer Protection Act 68 of 2008 (“CPA”) apply where you are a
                consumer.
              </p>
            </>
          ),
        },
        {
          title: "2. Who these Terms apply to",
          content: (
            <>
              <p>
                These Terms apply to anyone who accesses Story Time, including viewers,
                creators, music contributors, equipment companies, location owners, crew
                teams, casting agencies, catering providers, and administrators.
              </p>
              <p>
                If you use Story Time on behalf of a business, you represent that you
                have authority to bind that business, and “you” includes that entity.
              </p>
            </>
          ),
        },
        {
          title: "3. Eligibility and account age",
          content: (
            <>
              <p>
                You must be at least 18 years old (or the age of majority where you live)
                to create a primary Story Time account and enter into paid transactions.
                Parents or legal guardians may set up and supervise child viewer profiles
                where that feature is available.
              </p>
              <p>
                You are responsible for ensuring that any profile under your account
                complies with age ratings, advisories, and parental-control settings.
              </p>
            </>
          ),
        },
        {
          title: "4. Accounts, security, and deletion",
          content: (
            <>
              <p>
                You must provide accurate registration information and keep login
                credentials confidential. You are responsible for activity under your
                account unless you promptly notify us of unauthorized access.
              </p>
              <p>
                We use authenticated access, session controls, role-based permissions,
                and activity logging. We may suspend or restrict access where we detect
                abuse, fraud risk, security threats, or policy breaches.
              </p>
              <p>
                You may export your data and permanently delete your account from
                in-product Privacy &amp; account control settings, consistent with Apple
                App Store Guideline 5.1.1(v), Google Play User Data policy (in-app and
                web deletion), and our Privacy Policy. Deletion removes personal data we
                are not legally required to retain.
              </p>
            </>
          ),
        },
        {
          title: "5. The Story Time service",
          content: (
            <>
              <p>
                Story Time is a digital entertainment and production platform that may
                include streaming catalogues, creator publishing and monetization tools,
                marketplace listings, collaboration features, and related workflows.
                Features may vary by role, plan, geography, and device.
              </p>
              <p>
                We may modify, suspend, or discontinue features with reasonable notice
                where practicable. We do not guarantee that every title, tool, or
                marketplace listing will remain available indefinitely.
              </p>
            </>
          ),
        },
        {
          title: "6. Acceptable use",
          content: (
            <>
              <p>
                You may use Story Time only for lawful purposes and in line with our{" "}
                <a href="/legal/acceptable-use" className="text-orange-300 underline-offset-2 hover:underline">
                  Acceptable Use Policy
                </a>
                . Without limitation, you may not upload unlawful or infringing material,
                impersonate others, bypass age or subscription controls, scrape or
                overload the service, attempt unauthorized access, interfere with
                operations, or engage in fraudulent or abusive conduct.
              </p>
            </>
          ),
        },
        {
          title: "7. Content ownership and licenses",
          content: (
            <>
              <p>
                Creators retain ownership of content they submit, subject to rights
                already granted to collaborators, licensors, or third parties. You may
                upload only content you own or are authorized to use.
              </p>
              <p>
                By uploading or submitting material, you grant Story Time a worldwide,
                non-exclusive, royalty-free license to host, store, process, review,
                stream, display, distribute, promote, and administer that material as
                needed to operate and improve the platform and related business
                operations, for as long as the content remains on the service or as
                otherwise required for legal compliance.
              </p>
              <p>
                Viewers receive a limited, personal, non-transferable, non-exclusive
                license to stream or access content solely through authorized Story Time
                interfaces while entitled under an applicable plan. No ownership of
                underlying intellectual property is transferred to viewers.
              </p>
            </>
          ),
        },
        {
          title: "8. Moderation and enforcement",
          content: (
            <>
              <p>
                We may review submissions, metadata, age ratings, and advisories. We may
                remove content, restrict visibility, reject submissions, pause
                distribution, or suspend or terminate accounts where we believe a user
                has violated these Terms, our policies, or the law.
              </p>
              <p>
                We may also respond to valid copyright notices, legal process, safety
                concerns, and repeated policy violations. Enforcement decisions are made
                in good faith to protect users, rights holders, and platform integrity.
              </p>
            </>
          ),
        },
        {
          title: "9. Payments, subscriptions, and digital goods",
          content: (
            <>
              <p>
                Certain features require payment. Pricing, billing cycles, and
                entitlements are disclosed before checkout. Viewer subscriptions,
                creator licenses, and business plans are governed by our{" "}
                <a href="/legal/subscription-terms" className="text-orange-300 underline-offset-2 hover:underline">
                  Subscription Terms
                </a>
                ,{" "}
                <a href="/legal/payment-policy" className="text-orange-300 underline-offset-2 hover:underline">
                  Payment Policy
                </a>
                , and{" "}
                <a href="/legal/refund-policy" className="text-orange-300 underline-offset-2 hover:underline">
                  Refund Policy
                </a>
                .
              </p>
              <p>
                Web and browser payments are typically processed through licensed
                gateways such as PayFast. Story Time does not intentionally store full
                card PAN or CVV. If a native application is distributed through the Apple
                App Store, Google Play, Amazon Appstore, or a connected-TV store and that
                platform requires its own billing system for digital content or
                subscriptions (for example Apple In-App Purchase or Google Play Billing),
                those purchases will additionally be subject to the store operator’s
                terms, billing, and refund rules for the relevant transaction.
              </p>
            </>
          ),
        },
        {
          title: "10. Third-party services and app / TV distribution",
          content: (
            <>
              <p>
                The platform may integrate third-party services (authentication,
                payments, hosting, analytics, DRM or playback SDKs). Your use of those
                services may be subject to their own terms and privacy policies.
              </p>
              <p>
                <strong className="text-slate-200">Apple App Store.</strong> If you
                access Story Time through an Apple device or App Store application:
                (a) these Terms are between you and STORYTIME STUDIOS (Pty) Ltd, not
                Apple; (b) Apple has no obligation to provide maintenance or support for
                the app beyond what Apple’s own rules require; (c) to the maximum extent
                permitted by law, Apple has no warranty obligation for the app;
                (d) Apple is not responsible for product claims, consumer protection
                claims, or intellectual-property infringement claims arising from the
                app; and (e) Apple and Apple’s subsidiaries are third-party beneficiaries
                of this Apple paragraph and may enforce it.
              </p>
              <p>
                <strong className="text-slate-200">Google Play and Android.</strong> If
                you access Story Time through Google Play or an Android device, these
                Terms are between you and STORYTIME STUDIOS (Pty) Ltd, not Google. Google
                is not a party to this agreement and is not responsible for the app,
                its content, or support, except as required under Google’s own
                agreements with you. Google Play Billing purchases are also subject to
                Google’s payment and refund policies.
              </p>
              <p>
                <strong className="text-slate-200">Other distributors and TV platforms.</strong>{" "}
                The same principle applies to Amazon Appstore / Fire TV, Android TV /
                Google TV, Apple TV, Samsung Tizen, LG webOS, Roku, carrier stores, and
                other OEMs or aggregators that may distribute Story Time: the agreement
                for the Story Time service is with STORYTIME STUDIOS (Pty) Ltd, while
                store billing, device accounts, and platform-level privacy controls remain
                governed by the relevant distributor’s terms.
              </p>
            </>
          ),
        },
        {
          title: "11. Privacy",
          content: (
            <>
              <p>
                Our collection and use of personal information is described in the{" "}
                <a href="/legal/privacy" className="text-orange-300 underline-offset-2 hover:underline">
                  Privacy Policy
                </a>
                . By using Story Time, you acknowledge that processing described there.
              </p>
            </>
          ),
        },
        {
          title: "12. Disclaimers and limitation of liability",
          content: (
            <>
              <p>
                Story Time is provided on an “as available” basis. We work to maintain
                quality and reliability, but we do not guarantee uninterrupted,
                error-free, or complete suitability for every purpose.
              </p>
              <p>
                User-generated content is the responsibility of the uploader. To the
                maximum extent permitted by law, Story Time is not liable for indirect,
                incidental, consequential, special, or punitive loss arising from use of
                the platform, user content, third-party actions, or service
                interruptions.
              </p>
              <p>
                Nothing in these Terms excludes or limits liability that cannot be
                excluded under the CPA or other mandatory law, including liability for
                gross negligence where such exclusion is prohibited.
              </p>
            </>
          ),
        },
        {
          title: "13. Indemnity",
          content: (
            <>
              <p>
                To the extent permitted by law, you agree to indemnify and hold harmless
                STORYTIME STUDIOS (Pty) Ltd and its directors, employees, and agents
                from claims, damages, and costs arising from your content, your misuse of
                the service, or your breach of these Terms or applicable law, except to
                the extent caused by our unlawful conduct.
              </p>
            </>
          ),
        },
        {
          title: "14. Suspension and termination",
          content: (
            <>
              <p>
                You may stop using Story Time and delete your account at any time. We may
                suspend or terminate access for breach, legal risk, non-payment, or
                extended inactivity. Provisions that by nature should survive
                (including ownership, licenses already exercised, payment obligations,
                disclaimers, and liability limits) will survive termination.
              </p>
            </>
          ),
        },
        {
          title: "15. Governing law and disputes",
          content: (
            <>
              <p>
                These Terms are governed by the laws of the Republic of South Africa,
                subject to any mandatory consumer protections that apply in your
                jurisdiction.
              </p>
              <p>
                Please contact support first so we can attempt to resolve concerns
                informally. Nothing in these Terms prevents you from referring a
                consumer dispute to the National Consumer Commission or another
                competent forum where the CPA or other law so provides.
              </p>
              <p>
                To the extent required by the CPA, nothing here waives non-waivable
                consumer rights, including fair and reasonable terms (sections 48–49),
                plain-language disclosure (section 22), and rights linked to service
                performance (section 54).
              </p>
            </>
          ),
        },
        {
          title: "16. Changes to these Terms",
          content: (
            <>
              <p>
                We may update these Terms from time to time. The “Last updated” date will
                change when we do. Material changes will be posted on the platform or
                communicated where required by law. Continued use after the effective
                date constitutes acceptance to the extent permitted by applicable law.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Official legal and operational contact: support@story-time.online | +27
          61 657 2691. For legal notices, billing disputes, policy questions, or
          escalation requests, contact STORYTIME STUDIOS (Pty) Ltd (CIPC registration
          number 2026/269060/07) through these channels.
        </p>
      }
    />
  );
}
