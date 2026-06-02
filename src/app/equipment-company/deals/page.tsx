import { CompanyDealsPage } from "@/components/ecosystem/company-deals-page";

export default function EquipmentDealsPage() {
  return (
    <CompanyDealsPage
      title="Rental pipeline"
      subtitle="Every equipment request from creators — with kit preview, dates, and payment status."
      backHref="/equipment-company/dashboard"
      apiPath="/api/equipment-company/deals"
      accent="cyan"
    />
  );
}
