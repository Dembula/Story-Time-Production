import { LegalPage } from "@/components/legal/LegalPage";

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Cookies"
      title="Cookie Policy"
      summary="Story Time uses cookies and similar technologies to support sign-in, session continuity, viewer profile selection, security operations, and product analytics."
      lastUpdated="April 2026"
      highlights={["Auth sessions", "Viewer profiles", "Security signals", "POPIA aligned"]}
      sections={[
        {
          title: "1. Why we use cookies",
          content: (
            <>
              <p>
                Cookies help Story Time recognize returning users, maintain active
                sessions, remember selected viewer profiles, and reduce the need to
                re-enter information during normal use.
              </p>
              <p>
                We also use cookie-linked data to improve platform reliability, analyze
                usage patterns, and support fraud and abuse detection.
              </p>
            </>
          ),
        },
        {
          title: "2. Types of cookies and similar technologies",
          content: (
            <>
              <p>
                Story Time may use essential cookies for login and platform security,
                functional cookies for preferences and session continuity, and
                analytics-related technologies to understand engagement and improve the
                product.
              </p>
              <p>
                We may also use secure HTTP-only cookies in situations where profile or
                session state must be protected from normal browser-side access.
              </p>
              <p>
                Cookie categories are applied in line with ECTA and POPIA principles of
                transparency, purpose limitation, and security safeguards.
              </p>
            </>
          ),
        },
        {
          title: "3. Your choices",
          content: (
            <>
              <p>
                Most browsers allow you to control or block cookies. If you disable
                essential cookies, some parts of Story Time may stop working correctly,
                especially authentication, subscription access, and viewer profile
                features.
              </p>
              <p>
                You can also clear stored cookies through your browser settings at any
                time.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Cookie and tracking contact: support@story-time.online | +27 61 657
          2691. You can use these channels for consent, preference, or data-use
          questions linked to cookies and similar technologies.
        </p>
      }
    />
  );
}
