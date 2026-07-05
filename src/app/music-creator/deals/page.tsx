import { CompanyDealsPage } from "@/components/ecosystem/company-deals-page";

export default function MusicCreatorDealsPage() {
  return (
    <CompanyDealsPage
      title="Sync deal pipeline"
      subtitle="Inbound sync requests, approved licenses, and paid placements across Story Time productions."
      backHref="/music-creator/dashboard"
      apiPath="/api/music-creator/deals"
      accent="violet"
    />
  );
}
