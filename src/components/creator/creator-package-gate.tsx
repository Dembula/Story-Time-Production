"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY } from "@/lib/pricing";
import { isCreatorOnboardingExemptPath } from "@/lib/creator-package-gate";

type LicensePayload = {
  packageComplete?: boolean;
  onboardingPath?: string;
};

export function CreatorPackageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const exempt = isCreatorOnboardingExemptPath(pathname, role);
  const enabled = role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY, "package-gate"],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()) as Promise<LicensePayload>,
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!enabled || exempt) return;
    if (isLoading || isFetching) return;
    if (data?.packageComplete === false) {
      router.replace(data.onboardingPath ?? "/creator/onboarding/license");
    }
  }, [data, enabled, exempt, isFetching, isLoading, router]);

  if (!enabled || exempt) {
    return <>{children}</>;
  }

  if ((isLoading || isFetching) && data?.packageComplete !== true) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (data?.packageComplete === false) {
    return null;
  }

  return <>{children}</>;
}
