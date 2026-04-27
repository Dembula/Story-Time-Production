"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const SESSION_KEY_PREFIX = "st_product_analytics_v1";

export function ProductAnalytics() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || !pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const dedupeKey = `${SESSION_KEY_PREFIX}:${session.user.id}:${pathname}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(dedupeKey)) return;

    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "route_view", path: pathname }),
    })
      .then((r) => {
        if (r.ok && typeof window !== "undefined") {
          window.sessionStorage.setItem(dedupeKey, "1");
        }
      })
      .catch(() => {});
  }, [pathname, session?.user?.id, status]);

  return null;
}
