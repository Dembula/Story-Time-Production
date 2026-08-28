import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MarketplaceListingDetail } from "@/components/marketplace/marketplace-listing-detail";
import { getMarketplaceCategory, type MarketplaceCategoryId } from "@/lib/marketplace-hub";

const VALID: MarketplaceCategoryId[] = ["casting", "crew", "locations", "equipment", "catering"];

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ category: string; id: string }>;
}) {
  const { category, id } = await params;
  if (!VALID.includes(category as MarketplaceCategoryId) || !getMarketplaceCategory(category)) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">Loading listing…</div>
      }
    >
      <MarketplaceListingDetail categoryId={category as MarketplaceCategoryId} listingId={id} />
    </Suspense>
  );
}
