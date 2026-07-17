import { LegalPage } from "@/components/legal/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="This Privacy Policy explains how STORYTIME STUDIOS (Pty) Ltd (“Story Time”, “we”, “us”, or “our”) collects, uses, shares, retains, and protects personal information when you use the Story Time platform at story-time.online and related services. It is designed to meet the Protection of Personal Information Act 4 of 2013 (“POPIA”), applicable South African law, and the privacy expectations of major app distributors—including the Apple App Store, Google Play, Amazon Appstore, and connected TV / streaming platforms."
      lastUpdated="July 2026"
      highlights={["POPIA", "Apple & Google Play", "In-app + web deletion", "TV / multi-platform"]}
      sections={[
        {
          title: "1. Who we are and how to contact us",
          content: (
            <>
              <p>
                The responsible party (data controller) for personal information processed
                through Story Time is STORYTIME STUDIOS (Pty) Ltd (CIPC registration
                number 2026/269060/07), a private company incorporated in the Republic
                of South Africa, operating the Story Time digital entertainment and
                creator platform.
              </p>
              <p>
                Privacy, data-subject, and Information Officer requests may be sent to:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Email: support@story-time.online</li>
                <li>Phone: +27 61 657 2691</li>
                <li>Website: https://story-time.online</li>
              </ul>
              <p>
                We will verify your identity before disclosing or deleting personal
                information where reasonably necessary to protect accounts and other
                users.
              </p>
            </>
          ),
        },
        {
          title: "2. Scope of this Policy",
          content: (
            <>
              <p>
                This Policy applies to viewers, creators, music contributors, marketplace
                stakeholders (including equipment, location, crew, casting, and catering
                businesses), administrators, and visitors who access Story Time via web,
                mobile browser, progressive web apps, or native / store-distributed
                applications—including iOS, Android, tablets, and connected-TV or
                living-room devices (for example Android TV / Google TV, Apple TV,
                Amazon Fire TV, Samsung Tizen, LG webOS, Roku, or similar platforms where
                Story Time is made available).
              </p>
              <p>
                It covers personal information collected through registration,
                authentication (including Sign in with Apple, Google, and other OAuth
                providers where enabled), subscriptions, payments, content uploads,
                messaging, support requests, device and playback diagnostics, and
                platform analytics.
              </p>
            </>
          ),
        },
        {
          title: "3. Categories of personal information we collect",
          content: (
            <>
              <p>
                Consistent with transparent disclosure expectations used by major stores
                (including Apple App Privacy labelling and Google Play Data safety
                declarations), we may collect the following categories:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-slate-200">Identity and contact data:</strong>{" "}
                  name, email address, phone number (where provided), account identifiers,
                  and profile display details.
                </li>
                <li>
                  <strong className="text-slate-200">Account and authentication data:</strong>{" "}
                  hashed passwords (where credentials are used), OAuth tokens or provider
                  identifiers (including Apple user identifiers), session tokens, and
                  sign-in history.
                </li>
                <li>
                  <strong className="text-slate-200">Viewer profile data:</strong>{" "}
                  profile names, age or age-band settings used for content gating, and
                  viewing preferences.
                </li>
                <li>
                  <strong className="text-slate-200">Creator and business data:</strong>{" "}
                  project metadata, uploaded media and scripts, listing information,
                  verification documents where required for payouts or KYC, and
                  collaboration records.
                </li>
                <li>
                  <strong className="text-slate-200">Payment and transaction data:</strong>{" "}
                  plan type, billing status, amounts, currency (typically ZAR), payment
                  references, and limited gateway metadata. We do not intentionally store
                  full card PAN or CVV; card processing is handled by licensed payment
                  partners (including PayFast).
                </li>
                <li>
                  <strong className="text-slate-200">Usage and device data:</strong>{" "}
                  IP address, browser or device type, operating system, app version,
                  approximate location derived from IP, crash or diagnostic signals,
                  playback quality metrics on supported devices (including TV clients),
                  advertising or app-instance identifiers where permitted by platform
                  rules, cookie or similar technology identifiers, and interaction logs.
                </li>
                <li>
                  <strong className="text-slate-200">Communications:</strong> support
                  tickets, messages sent through platform tools, and records needed to
                  investigate disputes or policy violations.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: "4. How we collect information",
          content: (
            <>
              <p>We collect personal information when you:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>create or manage an account;</li>
                <li>sign in with Apple, Google, GitHub, email, or other enabled methods;</li>
                <li>set up viewer profiles or age controls;</li>
                <li>subscribe, purchase, or request a refund;</li>
                <li>upload, publish, or license content;</li>
                <li>use messaging, marketplace, or production tools;</li>
                <li>contact support; or</li>
                <li>browse the service (through cookies, logs, and similar technologies).</li>
              </ul>
              <p>
                We may also receive limited information from payment processors,
                authentication providers, hosting and infrastructure vendors, and (where
                legally required) verification or compliance partners.
              </p>
            </>
          ),
        },
        {
          title: "5. Purposes of processing and legal bases (POPIA)",
          content: (
            <>
              <p>We process personal information only for lawful purposes, including to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>create and secure accounts and authenticate users;</li>
                <li>provide streaming, creator, and marketplace functionality;</li>
                <li>apply age-aware access controls and content advisories;</li>
                <li>process payments, subscriptions, payouts, and billing disputes;</li>
                <li>moderate content, enforce policies, and prevent fraud or abuse;</li>
                <li>provide customer support and service communications;</li>
                <li>improve reliability, performance, and product quality;</li>
                <li>comply with legal, tax, accounting, and regulatory obligations; and</li>
                <li>establish, exercise, or defend legal claims.</li>
              </ul>
              <p>
                Under POPIA, processing is typically based on one or more of: your
                consent (where required), performance of a contract with you, our
                legitimate interests in operating a secure platform (balanced against your
                rights), and compliance with a legal obligation. You may withdraw consent
                where processing is consent-based, without affecting prior lawful
                processing.
              </p>
            </>
          ),
        },
        {
          title: "6. Sharing, processors, and third parties",
          content: (
            <>
              <p>
                We do <strong className="text-slate-200">not sell</strong> personal
                information. We do not share personal information with third parties for
                their independent marketing without your consent.
              </p>
              <p>
                We may share information with trusted service providers who process data
                on our instructions and under contractual safeguards, including:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>cloud hosting, storage, and content-delivery providers;</li>
                <li>authentication providers (including Apple, Google, and GitHub where used);</li>
                <li>payment gateways (including PayFast) and related banking networks;</li>
                <li>email and transactional messaging providers;</li>
                <li>analytics or monitoring tools used to operate and secure the service; and</li>
                <li>professional advisers (legal, audit) under confidentiality obligations.</li>
              </ul>
              <p>
                We may also disclose information when required by law, court order, or
                regulator; to protect Story Time, our users, rights holders, or the
                public; or in connection with a corporate reorganization, merger, or
                asset transfer subject to continued privacy protections.
              </p>
            </>
          ),
        },
        {
          title: "7. Cross-border transfers",
          content: (
            <>
              <p>
                Story Time is operated from South Africa. Some infrastructure, payment,
                authentication, or support providers may process information in other
                countries. Where cross-border transfers occur, we apply POPIA section 72
                safeguards, including contractual commitments and operational controls
                designed to keep personal information secure and used only for permitted
                purposes.
              </p>
            </>
          ),
        },
        {
          title: "8. Cookies, sessions, and similar technologies",
          content: (
            <>
              <p>
                We use cookies and similar technologies for essential authentication,
                session continuity, security, preference storage (including viewer profile
                selection), and limited product analytics. Details are set out in our{" "}
                <a href="/legal/cookies" className="text-orange-300 underline-offset-2 hover:underline">
                  Cookie Policy
                </a>
                .
              </p>
              <p>
                Essential cookies are required for the service to function. Where
                non-essential analytics, advertising identifiers, or tracking
                technologies are introduced, we will obtain any required consent and
                provide controls consistent with applicable law and platform rules—
                including Apple App Tracking Transparency on iOS, Google Play User Data
                and advertising-ID requirements on Android, and equivalent TV or OEM
                privacy controls where those platforms impose them.
              </p>
            </>
          ),
        },
        {
          title: "9. Retention",
          content: (
            <>
              <p>
                We retain personal information only for as long as reasonably necessary
                to provide the service, meet legal and accounting obligations, resolve
                disputes, investigate abuse, and enforce agreements.
              </p>
              <p>
                Typical retention considerations include the life of your account,
                subscription and tax record periods, moderation and security
                investigation needs, and statutory limitation periods. When retention is
                no longer required, we delete or anonymise personal information where
                feasible.
              </p>
            </>
          ),
        },
        {
          title: "10. Your rights and multi-store account controls",
          content: (
            <>
              <p>
                Subject to POPIA and other applicable law, you may request access to
                your personal information, correction of inaccurate records, deletion or
                destruction where retention is no longer required, objection to certain
                processing, and restriction of processing in defined circumstances. You
                may also lodge a complaint with the Information Regulator (South Africa).
              </p>
              <p>
                In line with Apple App Store Guideline 5.1.1(v), Google Play User Data
                policy (including in-app and external web account-deletion requirements),
                and comparable rules of other app distributors, signed-in users can:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-slate-200">Export</strong> a machine-readable
                  copy of their account data from in-product Privacy &amp; account
                  control settings; and
                </li>
                <li>
                  <strong className="text-slate-200">Delete</strong> their account from
                  those same in-product controls (viewers: Settings; creators and music
                  creators: Account → Security; marketplace stakeholders: Profile /
                  Account pages), including within store-distributed mobile or TV apps
                  where account creation is offered.
                </li>
              </ul>
              <p>
                <strong className="text-slate-200">Google Play web deletion resource:</strong>{" "}
                Users may also request account and associated data deletion without using
                the native app by contacting support@story-time.online (or +27 61 657
                2691) and identifying the account email, or by using Story Time’s web
                account Privacy &amp; account control settings at story-time.online when
                signed in. This Privacy Policy page and those channels are intended to
                satisfy Google Play’s requirement for an external web resource linked
                from Play Console Data safety / Data deletion disclosures.
              </p>
              <p>
                Account deletion removes the account and associated personal data that we
                are not legally required to retain. Temporary deactivation or “freezing”
                alone is not treated as deletion. Where hard deletion is blocked by
                legal, tax, fraud-prevention, safety, or regulatory obligations, we
                anonymise or de-identify personal identifiers so the account can no longer
                be used to sign in, and we disclose those retention categories in this
                Policy.
              </p>
              <p>
                If you signed in with Apple or Google, account deletion includes steps
                reasonably available to discontinue associated platform credentials.
                Where provider token-revocation APIs apply to our integration, we revoke
                or invalidate related tokens as part of deletion processing.
              </p>
            </>
          ),
        },
        {
          title: "11. Children, Families, and age-restricted experiences",
          content: (
            <>
              <p>
                Story Time is intended for users who can lawfully enter into an account
                agreement. Primary account holders should be 18 years or older (or the
                age of majority in their jurisdiction). Parents or guardians may create
                and supervise child viewer profiles where the product supports that
                feature.
              </p>
              <p>
                We use profile age settings and content ratings to restrict access to
                age-inappropriate material. We do not knowingly collect personal
                information from children for marketing purposes, and we design
                age-gating with regard to store Families / child-safety expectations
                (including Google Play Families Policy principles and Apple kids /
                age-rating rules) where those distribution channels apply. If you believe
                a child has provided personal information without appropriate authority,
                contact us and we will take reasonable steps to delete it.
              </p>
            </>
          ),
        },
        {
          title: "12. App stores, Android, and connected-TV platforms",
          content: (
            <>
              <p>
                When Story Time is distributed through third-party app marketplaces or
                device platforms, additional store or OEM rules may apply to how we
                declare data practices, obtain permissions, process payments, and handle
                account deletion. Without limiting the rest of this Policy, we aim to
                align with:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Apple App Store Review Guidelines (including privacy Guideline 5.1);</li>
                <li>Google Play Developer Program Policies and User Data policy (including Data safety forms and account deletion);</li>
                <li>Amazon Appstore and Fire TV content / privacy requirements where listed;</li>
                <li>Android TV / Google TV, Apple TV, Samsung, LG, Roku, and similar TV or set-top distribution policies where Story Time is offered; and</li>
                <li>any mandatory local consumer or privacy law that applies in the territories where the app is made available.</li>
              </ul>
              <p>
                Store operators (Apple, Google, Amazon, TV OEMs, and others) are
                independent controllers of data they collect under their own products
                (for example Google account, Play Billing, or device diagnostics). Their
                privacy notices also apply to that processing.
              </p>
            </>
          ),
        },
        {
          title: "13. Security safeguards",
          content: (
            <>
              <p>
                We implement technical and organisational measures appropriate to the
                risk, including encryption in transit, access controls, role-based
                permissions, session management, logging, and vendor due diligence.
                Further detail appears in our{" "}
                <a href="/legal/security-policy" className="text-orange-300 underline-offset-2 hover:underline">
                  Security Policy
                </a>
                .
              </p>
              <p>
                No method of transmission or storage is completely secure. You should
                use strong credentials, protect your devices, and sign out of shared
                systems—especially on household TV or shared living-room profiles.
              </p>
            </>
          ),
        },
        {
          title: "14. Automated decision-making and profiling",
          content: (
            <>
              <p>
                Story Time may use automated signals for fraud prevention, access
                gating, content recommendation, and policy enforcement. These processes
                are designed to support security and service quality. Where POPIA or
                other law grants related rights, you may contact us to request human
                review of a decision that produces significant legal or similarly
                significant effects.
              </p>
            </>
          ),
        },
        {
          title: "15. Changes to this Policy",
          content: (
            <>
              <p>
                We may update this Privacy Policy to reflect product, legal, store, or
                operational changes. The “Last updated” date at the top of this page
                will change when we do. Material changes will be highlighted on the
                platform or communicated by email where appropriate. Continued use after
                an update constitutes acceptance of the revised Policy to the extent
                permitted by law.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Privacy and data-rights contact for STORYTIME STUDIOS (Pty) Ltd (CIPC
          registration number 2026/269060/07): support@story-time.online | +27 61 657
          2691. Use these channels for access, correction, deletion, objection, export,
          Google Play / App Store deletion requests, Sign in with Apple or Google
          credential concerns, and complaints. You may also escalate to the Information
          Regulator (South Africa) where appropriate.
        </p>
      }
    />
  );
}
