import { CompanyDealsPage } from "@/components/ecosystem/company-deals-page";

export default function LocationDealsPage() {
  return (
    <CompanyDealsPage
      title="Booking pipeline"
      subtitle="Shoot bookings across your locations — see property previews and creator details in one timeline."
      backHref="/location-owner/dashboard"
      apiPath="/api/location-owner/deals"
      accent="emerald"
    />
  );
}
