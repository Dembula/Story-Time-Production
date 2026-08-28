import { Suspense } from "react";
import { StoryTimeLoadingScreen } from "@/components/ui/storytime-loader";
import { UnifiedMarketplaceHub } from "@/components/marketplace/unified-marketplace-hub";

export default function CreatorMarketplacePage() {
  return (
    <Suspense fallback={<StoryTimeLoadingScreen />}>
      <UnifiedMarketplaceHub />
    </Suspense>
  );
}
