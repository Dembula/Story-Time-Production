"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ModocProvider } from "@/components/modoc";
import { ModocRouteSync } from "@/components/modoc/modoc-route-sync";
import { ModocVaShell } from "@/components/modoc/modoc-va-shell";
import { ModocViewerShell } from "@/components/modoc/modoc-viewer-shell";
import { AdaptiveUiProvider } from "@/components/adaptive/adaptive-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { MiniPlayer } from "@/components/player/mini-player";
import { SessionTelemetry } from "@/components/session-telemetry";
import { ProductAnalytics } from "@/components/product-analytics";
import { PayoutKycBanner } from "@/components/payout-kyc/payout-kyc-banner";
import { FunderVerificationBanner } from "@/components/funders/funder-verification-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <SessionTelemetry />
      <ProductAnalytics />
      <QueryClientProvider client={queryClient}>
        <AdaptiveUiProvider>
          <MotionProvider>
            <ModocProvider>
              {children}
              <ModocRouteSync />
              <ModocVaShell />
              <ModocViewerShell />
              <PayoutKycBanner />
              <FunderVerificationBanner />
              <MiniPlayer />
            </ModocProvider>
          </MotionProvider>
        </AdaptiveUiProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
