import { LegalPage } from "@/components/legal/LegalPage";

export default function CopyrightPage() {
  return (
    <LegalPage
      eyebrow="Rights"
      title="Copyright and Takedown"
      summary="Story Time respects creator ownership and third-party intellectual-property rights. This notice explains how ownership works on the platform and how infringement complaints may be handled."
      lastUpdated="March 2026"
      highlights={["Creator-owned works", "Platform license", "Notice process"]}
      sections={[
        {
          title: "1. Ownership on Story Time",
          content: (
            <>
              <p>
                Unless stated otherwise, content available through Story Time belongs to
                Story Time, the relevant creator, or the applicable rights holder or
                licensor.
              </p>
              <p>
                Uploading content to Story Time does not transfer ownership to the
                platform. Creators remain responsible for ensuring that they hold the
                rights needed for distribution and use.
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
                limited rights needed to store, display, stream, review, administer,
                promote, and distribute that content within the scope of the service
                and any applicable product workflow.
              </p>
              <p>
                This license is limited to operating the platform and does not reduce
                the creator&apos;s underlying ownership.
              </p>
            </>
          ),
        },
        {
          title: "3. Copyright complaints and takedown notices",
          content: (
            <>
              <p>
                If you believe content on Story Time infringes your rights, your notice
                should identify the protected work, the allegedly infringing material,
                your authority to act, your good-faith basis for the complaint, and the
                information reasonably needed to review the claim.
              </p>
              <p>
                Story Time may remove or disable access to material while a complaint is
                being assessed and may act against repeat infringers where justified.
              </p>
            </>
          ),
        },
        {
          title: "4. Counter-notices",
          content: (
            <>
              <p>
                If content is removed and the affected user believes the notice was
                mistaken or invalid, Story Time may allow a counter-notice process
                consistent with applicable law and operational policy.
              </p>
              <p>
                We may keep content disabled while a legal or rights dispute remains
                unresolved.
              </p>
            </>
          ),
        },
        {
          title: "5. Platform disclaimer",
          content: (
            <>
              <p>
                User-uploaded content reflects the views and responsibility of the
                relevant uploader or rights holder, not necessarily Story Time.
              </p>
              <p>
                Story Time does not guarantee that all user-submitted material is
                accurate, lawful, or free from third-party claims, even where review
                steps are used.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Story Time still needs a dedicated public-facing takedown contact path before
          launch at scale. That notice channel should be added here for full
          operational readiness.
        </p>
      }
    />
  );
}
