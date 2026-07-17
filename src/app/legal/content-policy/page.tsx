import { LegalPage } from "@/components/legal/LegalPage";

export default function ContentPolicyPage() {
  return (
    <LegalPage
      eyebrow="Moderation"
      title="Content Policy"
      summary="STORYTIME STUDIOS (Pty) Ltd (“Story Time”) operates a structured entertainment platform—not an unrestricted file host. This Content Policy sets creator responsibilities, prohibited material, age and classification standards, and enforcement expectations under South African law (including the Films and Publications Act where applicable) and Apple App Store content safety principles."
      lastUpdated="July 2026"
      highlights={["Creator clearances", "Child safety", "Age ratings", "Takedowns"]}
      sections={[
        {
          title: "1. Creator responsibility and rights clearances",
          content: (
            <>
              <p>
                Creators are solely responsible for ensuring they hold all rights,
                licences, releases, and clearances needed for material they upload,
                submit, display, or distribute through Story Time.
              </p>
              <p>
                This includes rights in video, audio, music, scripts, images,
                performances, trademarks, names and likenesses, and any third-party
                materials embedded in a project. Uploading content you are not
                authorized to use is a material breach of these policies.
              </p>
            </>
          ),
        },
        {
          title: "2. Prohibited content",
          content: (
            <>
              <p>Story Time does not permit, among other things:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>illegal content or content that facilitates criminal activity;</li>
                <li>sexual exploitation, pornography involving minors, or any child sexual abuse material (zero tolerance);</li>
                <li>non-consensual intimate imagery or exploitative deepfakes;</li>
                <li>unlawful hate content or content that incites violence;</li>
                <li>terrorist propaganda or content that endangers public safety;</li>
                <li>fraudulent, deceptive, or impersonating uploads;</li>
                <li>material that infringes intellectual property or other legal rights; and</li>
                <li>malware, phishing, or technical attacks disguised as media.</li>
              </ul>
              <p>
                We may also reject or restrict material that creates unacceptable legal,
                brand, payment-partner, platform-safety, or audience-trust risk,
                including content that would be inappropriate under Apple App Store
                content guidelines for apps that reach general audiences.
              </p>
            </>
          ),
        },
        {
          title: "3. Metadata, age ratings, and advisories",
          content: (
            <>
              <p>
                Creators must provide accurate metadata where requested, including
                titles, descriptions, advisories, age-rating signals, and other details
                needed for safe discovery and compliant distribution.
              </p>
              <p>
                Story Time may use viewer-profile age information and internal review
                controls to restrict access to unsuitable content. Misrepresenting age
                ratings or concealing advisories is prohibited.
              </p>
              <p>
                Classification and audience controls are applied with regard to South
                African standards, including the Films and Publications Act 65 of 1996
                (as amended) and related regulations where applicable.
              </p>
            </>
          ),
        },
        {
          title: "4. Review, publication, and takedown",
          content: (
            <>
              <p>
                Story Time may review submissions before public release, request
                changes, decline publication, unpublish content, or limit visibility
                where policy, rights, or safety risk requires it.
              </p>
              <p>
                We respond to valid copyright notices, legal complaints, moderation
                escalations, and law-enforcement requests by removing or disabling
                access to content where appropriate. See our{" "}
                <a href="/legal/copyright" className="text-orange-300 underline-offset-2 hover:underline">
                  Copyright Notice
                </a>{" "}
                for infringement procedures.
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
                access entirely. Severe violations (including any involvement with child
                sexual abuse material) may result in immediate termination and referral
                to authorities.
              </p>
              <p>
                We may preserve relevant records for appeals, disputes, investigations,
                or legal obligations as described in our Privacy Policy.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          Content reporting and takedown contact: support@story-time.online | +27
          61 657 2691. Rights holders and users can submit complaints, infringement
          notices, and moderation appeals through these channels.
        </p>
      }
    />
  );
}
