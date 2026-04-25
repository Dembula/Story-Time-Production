"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY } from "@/lib/pricing";
import {
  isStudioPathBlockedBySuites,
  suiteBlockRedirect,
  type CreatorSuiteAccessMap,
} from "@/lib/creator-suite-access";

type LicenseQueryPayload = {
  pipelineAccess?: boolean;
  suiteAccess?: CreatorSuiteAccessMap;
};

export function CreatorPipelineRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()) as Promise<LicenseQueryPayload>,
  });

  useEffect(() => {
    if (isLoading) return;
    const suite = data?.suiteAccess;
    if (suite && isStudioPathBlockedBySuites(pathname, suite)) {
      router.replace(suiteBlockRedirect(pathname));
    }
  }, [pathname, data, isLoading, router]);

  return <>{children}</>;
}
