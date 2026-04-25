"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ModocProvider } from "@/components/modoc";
import { AdaptiveUiProvider } from "@/components/adaptive/adaptive-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AdaptiveUiProvider>
          <ModocProvider>{children}</ModocProvider>
        </AdaptiveUiProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
