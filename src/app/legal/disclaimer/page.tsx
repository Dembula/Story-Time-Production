import { LegalPage } from "@/components/legal/LegalPage";

export default function DisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Disclaimer"
      title="Disclaimer"
      summary="StoryTime is provided on an as-is and as-available basis, subject to applicable law and non-waivable consumer rights."
      lastUpdated="April 2026"
      highlights={["As-is basis", "User-generated content", "Availability limits"]}
      sections={[
        {
          title: "1. Platform availability",
          content: (
            <>
              <p>
                StoryTime does not guarantee uninterrupted operation or error-free
                availability at all times. Service performance may be affected by
                maintenance, third-party dependencies, connectivity issues, or security
                events.
              </p>
            </>
          ),
        },
        {
          title: "2. User-generated content",
          content: (
            <>
              <p>
                StoryTime does not guarantee the accuracy, legality, or completeness of
                user-generated content. Users access and rely on platform content at
                their own risk.
              </p>
            </>
          ),
        },
        {
          title: "3. Limitation framework",
          content: (
            <>
              <p>
                To the maximum extent permitted by law, StoryTime excludes liability for
                indirect or consequential loss. Nothing in this disclaimer limits rights
                that cannot lawfully be excluded under South African consumer law.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          General legal contact: support@story-time.online | +27 61 657 2691.
        </p>
      }
    />
  );
}
