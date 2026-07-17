import { LegalPage } from "@/components/legal/LegalPage";

export default function CopyrightPage() {
  return (
    <LegalPage
      eyebrow="Rights"
      title="Copyright and Intellectual Property Notice"
      summary="STORYTIME STUDIOS (Pty) Ltd (“Story Time”) respects creator ownership and third-party intellectual-property rights. This notice explains ownership on the platform, the limited license granted to operate the service, and how infringement complaints are handled under South African copyright law and App Store IP expectations."
      lastUpdated="July 2026"
      highlights={["Creator-owned works", "Notice & takedown", "Counter-notice", "Repeat infringers"]}
      sections={[
        {
          title: "1. Ownership on Story Time",
          content: (
            <>
              <p>
                Unless stated otherwise, content available through Story Time belongs to
                Story Time, the relevant creator, or the applicable rights holder or
                licensor. Platform software, trademarks, logos, and branding remain the
                property of STORYTIME STUDIOS (Pty) Ltd or its licensors.
              </p>
              <p>
                Uploading content does not transfer ownership to Story Time. Creators
                remain responsible for ensuring they hold the rights needed for
                distribution and use.
              </p>
            </>
          ),
        },
        {
          title: "2. License granted to the platform",
          content: (
            <>
              <p>
                By uploading or submitting content, creators grant Story Time the
                limited, worldwide, non-exclusive rights needed to store, reproduce,
                display, stream, review, administer, promote, and distribute that content
                within the scope of the service and applicable product workflows.
              </p>
              <p>
                This license is limited to operating and improving the platform and does
                not reduce the creator’s underlying ownership. It ends when content is
                removed from the service, except for reasonable residual copies retained
                for backup, legal, or dispute purposes.
              </p>
            </>
          ),
        },
        {
          title: "3. Copyright complaints and takedown notices",
          content: (
            <>
              <p>
                If you believe content on Story Time infringes your rights, send a notice
                to support@story-time.online that includes:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>identification of the protected work;</li>
                <li>identification of the allegedly infringing material and its location (URL or title);</li>
                <li>your contact details;</li>
                <li>a statement of your authority to act for the rights holder;</li>
                <li>a good-faith statement that use is not authorized; and</li>
                <li>a statement that the information in the notice is accurate.</li>
              </ul>
              <p>
                We may remove or disable access while assessing a complaint and may act
                against repeat infringers. Notices should support review under the
                Copyright Act 98 of 1978 and related frameworks.
              </p>
            </>
          ),
        },
        {
          title: "4. Counter-notices",
          content: (
            <>
              <p>
                If content is removed and the uploader believes the notice was mistaken
                or invalid, they may submit a counter-notice with identification of the
                material, contact details, a good-faith statement explaining the error,
                and consent to jurisdiction of South African courts for related disputes
                where appropriate.
              </p>
              <p>
                We may keep content disabled while a legal or rights dispute remains
                unresolved.
              </p>
            </>
          ),
        },
        {
          title: "5. Trademarks and platform brand",
          content: (
            <>
              <p>
                “Story Time”, related marks, and the Story Time logo may not be used in
                a way that suggests endorsement or affiliation without prior written
                permission, except for truthful references permitted by law.
              </p>
            </>
          ),
        },
        {
          title: "6. Platform disclaimer",
          content: (
            <>
              <p>
                User-uploaded content reflects the responsibility of the uploader or
                rights holder. Story Time does not guarantee that all submitted material
                is accurate, lawful, or free from third-party claims, even where review
                steps are used.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Copyright and takedown contact: support@story-time.online | +27 61 657
          2691. Include rights ownership details, precise content location, authority
          to act, and a good-faith statement in all infringement notices.
        </p>
      }
    />
  );
}
