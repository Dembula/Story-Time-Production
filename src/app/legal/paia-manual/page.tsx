import { LegalPage } from "@/components/legal/LegalPage";

export default function PaiaManualPage() {
  return (
    <LegalPage
      eyebrow="Access to Information"
      title="PAIA Manual (Summary)"
      summary="StoryTime supports lawful access-to-information requests in accordance with the Promotion of Access to Information Act."
      lastUpdated="April 2026"
      highlights={["PAIA", "Request process", "Records access"]}
      sections={[
        {
          title: "1. Request requirements",
          content: (
            <>
              <p>
                Requests should include full name, contact details, a clear description
                of the records requested, and the lawful basis or reason for requesting
                access.
              </p>
            </>
          ),
        },
        {
          title: "2. Processing and timelines",
          content: (
            <>
              <p>
                StoryTime reviews requests in line with statutory timelines, identity
                verification requirements, and lawful grounds for access, refusal, or
                partial disclosure.
              </p>
            </>
          ),
        },
        {
          title: "3. Limitations and legal obligations",
          content: (
            <>
              <p>
                Access may be refused or limited where records contain protected
                personal information, confidential commercial information, privileged
                content, security-sensitive data, or where disclosure is otherwise
                restricted by law.
              </p>
            </>
          ),
        },
      ]}
      footerNote={
        <p>
          PAIA requests contact: support@story-time.online | +27 61 657 2691.
        </p>
      }
    />
  );
}
