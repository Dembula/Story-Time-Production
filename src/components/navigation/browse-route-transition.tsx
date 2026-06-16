"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { dismissNavOverlay } from "@/lib/navigation/route-transition";

/** Clears the exit overlay once a browse route has painted. */
export function BrowseRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    dismissNavOverlay();
  }, [pathname]);

  return children;
}
