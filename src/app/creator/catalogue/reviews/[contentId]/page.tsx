import { CatalogueReviewDetailClient } from "./catalogue-review-detail-client";

export default async function CatalogueReviewPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  return <CatalogueReviewDetailClient contentId={contentId} />;
}
