import { CompanyDealsPage } from "@/components/ecosystem/company-deals-page";

export default function CateringDealsPage() {
  return (
    <CompanyDealsPage
      title="Event pipeline"
      subtitle="Catering bookings from productions — headcount, dates, and messaging in one place."
      backHref="/catering-company/dashboard"
      apiPath="/api/catering-company/deals"
      accent="orange"
    />
  );
}
