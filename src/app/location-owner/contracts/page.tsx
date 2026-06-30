import { StakeholderLegalDashboard } from "@/components/legal/stakeholder-legal-dashboard";

export default function LocationOwnerContractsPage() {
  return (
    <StakeholderLegalDashboard
      portalPrefix="/location-owner"
      title="Location agreements"
      subtitle="Permit, rental, and location release contracts from productions using your listings."
    />
  );
}
