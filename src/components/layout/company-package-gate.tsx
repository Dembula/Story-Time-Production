"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  companyOnboardingPath,
  isCompanyOnboardingExemptPath,
  isCompanyRole,
} from "@/lib/company-package-gate";

export function CompanyPackageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const enabled = isCompanyRole(role);
  const exempt = isCompanyOnboardingExemptPath(pathname);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["company-package-gate", role],
    queryFn: () => fetch("/api/company/package-gate").then((r) => r.json()) as Promise<{ packageComplete?: boolean }>,
    enabled: Boolean(enabled),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!enabled || exempt) return;
    if (isLoading || isFetching) return;
    if (data?.packageComplete === false) {
      router.replace(companyOnboardingPath());
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
