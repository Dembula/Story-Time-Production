import { CompanyDealsPage } from "@/components/ecosystem/company-deals-page";

export default function CrewTeamDealsPage() {
  return (
    <CompanyDealsPage
      title="Jobs pipeline"
      subtitle="Inbound crew requests and formal project invitations from Story Time productions."
      backHref="/crew-team/dashboard"
      apiPath="/api/crew-team/deals"
      accent="emerald"
    />
  );
}
