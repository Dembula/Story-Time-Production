"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "st_telemetry_v1";

/**
 * Sends one telemetry row per browser session after sign-in so admin dashboards
 * can aggregate IP and device type from the database.
 */
export function SessionTelemetry() {
  const { data: session, status } = useSession();
  const sentRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || sentRef.current) return;
    const id = session.user.id;
    const key = `${STORAGE_PREFIX}:${id}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) {
      sentRef.current = true;
      return;
    }

    sentRef.current = true;
    void fetch("/api/session/telemetry", { method: "POST" })
      .then((r) => {
        if (r.ok && typeof window !== "undefined") {
          window.sessionStorage.setItem(key, "1");
        }
      })
      .catch(() => {
        sentRef.current = false;
      });
  }, [session?.user?.id, status]);

  return null;
}
