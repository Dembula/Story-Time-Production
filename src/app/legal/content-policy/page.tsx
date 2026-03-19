import { LegalPage } from "@/components/legal/LegalPage";

export default function ContentPolicyPage() {
  return (
    <LegalPage
      eyebrow="Moderation"
      title="Content Policy"
      summary="Story Time is designed as a structured entertainment platform, not an unrestricted file dump. This Policy explains the content rules, creator responsibilities, moderation expectations, and enforcement standards that apply to uploads and public distribution."
      lastUpdated="March 2026"
      highlights={["Creator responsibility", "Review controls", "Age-aware access"]}
      sections={[
        {
          title: "1. Creator responsibility and rights clearances",
          content: (
            <>
              <p>
                Creators are responsible for ensuring they have the rights, permissions,
                and clearances needed for any material they upload, submit, display, or
                distribute through Story Time.
              </p>
              <p>
                This includes rights relating to video, music, scripts, images,
                performances, trademarks, likenesses, and any third-party materials
                embedded in a project.
              </p>
            </>
          ),
        },
        {
          title: "2. Prohibited content",
          content: (
            <>
              <p>
                Story Time does not permit illegal content, non-consensual or
                exploitative material, unlawful hate content, extreme abuse, content
                that endangers minors, fraudulent uploads, or material that infringes
                third-party intellectual property or other legal rights.
              </p>
              <p>
                We may also reject or restrict material that creates unacceptable legal,
                brand, payment, platform-safety, or audience-trust risk.
              </p>
            </>
          ),
        },
        {
          title: "3. Metadata, age ratings, and advisories",
          content: (
            <>
              <p>
                Creators must provide accurate metadata where requested, including title
                information, advisories, age-rating signals, and other content details
                needed for safe discovery and compliant distribution.
              </p>
              <p>
                Story Time may use viewer-profile age information and internal review
                controls to restrict access to unsuitable content.
              </p>
            </>
          ),
        },
        {
          title: "4. Review, publication, and takedown controls",
          content: (
            <>
              <p>
                Story Time may review submissions before public release, request
                changes, decline publication, unpublish content, or limit visibility
                where platform policy or rights risk requires it.
              </p>
              <p>
                We may also respond to valid copyright notices, legal complaints,
                moderation escalations, or repeated account violations by removing or
                disabling access to content.
              </p>
            </>
          ),
        },
        {
          title: "5. Repeated or serious violations",
          content: (
            <>
              <p>
                Accounts that repeatedly upload infringing, unsafe, deceptive, or
                policy-violating content may lose publication privileges or platform
                access entirely.
              </p>
              <p>
                Story Time may preserve relevant records where required for appeals,
                disputes, investigations, or legal obligations.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Story Time should add a dedicated public reporting and takedown intake channel
          before large-scale commercial rollout so rights holders and users have a
          visible operational path for notices and disputes.
        </p>
      }
    />
  );
}
