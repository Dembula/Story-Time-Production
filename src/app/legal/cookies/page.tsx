import { LegalPage } from "@/components/legal/LegalPage";

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Cookies"
      title="Cookie Policy"
      summary="This Cookie Policy explains how STORYTIME STUDIOS (Pty) Ltd (“Story Time”) uses cookies and similar technologies on story-time.online and related services. It should be read with our Privacy Policy and is aligned with POPIA transparency principles, ECTA disclosure expectations, and platform rules from Apple, Google Play / Android, and connected-TV distributors where applicable."
      lastUpdated="July 2026"
      highlights={["Essential auth", "Preferences", "ATT & Ad ID", "TV platforms"]}
      sections={[
        {
          title: "1. What are cookies and similar technologies?",
          content: (
            <>
              <p>
                Cookies are small text files stored on your device. Similar technologies
                include local storage, session storage, pixels, and software development
                kit (SDK) identifiers that may be used in web or native applications.
              </p>
              <p>
                These technologies help Story Time recognize returning users, keep
                sessions secure, remember preferences, and understand how the product is
                used.
              </p>
            </>
          ),
        },
        {
          title: "2. Categories we use",
          content: (
            <>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-slate-200">Essential / strictly necessary:</strong>{" "}
                  sign-in, session integrity, CSRF and security protections, load
                  balancing, and subscription or role access checks. The service may not
                  function correctly without these.
                </li>
                <li>
                  <strong className="text-slate-200">Functional:</strong> remembering
                  viewer profile selection, UI preferences, and similar continuity
                  settings.
                </li>
                <li>
                  <strong className="text-slate-200">Analytics / performance:</strong>{" "}
                  aggregated usage metrics that help us improve reliability and product
                  quality. Where required, we seek consent before using non-essential
                  analytics.
                </li>
                <li>
                  <strong className="text-slate-200">Security and fraud signals:</strong>{" "}
                  identifiers and logs used to detect abuse, unauthorized access, and
                  payment risk.
                </li>
              </ul>
              <p>
                We do not use cookies to sell personal information. Advertising cookies,
                if ever introduced, will be disclosed and consent-controlled before
                activation.
              </p>
            </>
          ),
        },
        {
          title: "3. Apple, Android, and device privacy controls",
          content: (
            <>
              <p>
                If Story Time is distributed as a native iOS or Apple TV application and
                seeks to track users across apps or websites owned by other companies for
                purposes defined by Apple, we will request permission through Apple’s App
                Tracking Transparency (ATT) framework and honour the user’s choice.
              </p>
              <p>
                On Android and Google Play–distributed apps (including Android TV /
                Google TV where applicable), we will follow Google Play User Data policy
                requirements for declaration, consent, and use of advertising IDs or
                similar identifiers. Users may reset or limit advertising identifiers in
                device settings.
              </p>
              <p>
                First-party measurement needed to operate the service (for example, fraud
                prevention, authenticated session analytics, or playback diagnostics that
                is not “tracking” under the relevant platform definition) may continue as
                permitted by that platform’s rules and applicable law. Connected-TV OEMs
                (Amazon Fire TV, Samsung, LG, Roku, and similar) may impose additional
                privacy or analytics controls that we will honour where they apply.
              </p>
            </>
          ),
        },
        {
          title: "4. Your choices",
          content: (
            <>
              <p>
                Most browsers allow you to block or delete cookies. If you disable
                essential cookies, authentication, subscription access, and viewer
                profile features may stop working.
              </p>
              <p>
                You can clear stored cookies and local storage through your browser or
                device settings at any time. Device-level advertising or tracking
                controls—including Apple’s Privacy &amp; Security settings, Android /
                Google advertising controls, and TV or OEM privacy menus—should also be
                respected where they apply.
              </p>
            </>
          ),
        },
        {
          title: "5. Retention and updates",
          content: (
            <>
              <p>
                Cookie lifetimes vary: session cookies expire when you close the browser;
                persistent cookies remain until they expire or are deleted. We update
                this Policy when our use of cookies or similar technologies materially
                changes.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Cookie and tracking contact: support@story-time.online | +27 61 657
          2691. Contact us for consent, preference, or data-use questions linked to
          cookies and similar technologies.
        </p>
      }
    />
  );
}
