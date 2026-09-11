"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { sendAnalyticsBeacon } from "@/lib/analytics-beacon";
import { computePlaybackDeviceProfileClient } from "@/lib/player/mobile-detect";

function deviceProps() {
  const profile = computePlaybackDeviceProfileClient();
  return {
    family: profile.family,
    browser: profile.browser,
    isMobileLike: profile.isMobileLike,
    isIOS: profile.isIOS,
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null,
  };
}

/**
 * Tracks page activity + client crash/error signals for the admin ops overview.
 * Intentionally tiny — must not add memory pressure on mobile.
 */
export function ClientStabilityMonitor() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    sendAnalyticsBeacon({
      name: "page_view",
      path: pathname,
      properties: deviceProps(),
    });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onError = (event: ErrorEvent) => {
      sendAnalyticsBeacon({
        name: "client_error",
        path: window.location.pathname,
        properties: {
          ...deviceProps(),
          message: String(event.message || "error").slice(0, 240),
          source: String(event.filename || "").slice(0, 160),
          line: event.lineno ?? null,
          col: event.colno ?? null,
        },
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandledrejection";
      sendAnalyticsBeacon({
        name: "client_error",
        path: window.location.pathname,
        properties: {
          ...deviceProps(),
          message: String(message).slice(0, 240),
          kind: "unhandledrejection",
        },
      });
    };

    const onPageHide = () => {
      // iOS Safari OOM often dies without a JS error; pagehide is the last chance signal.
      const mem =
        typeof performance !== "undefined"
          ? (
              performance as Performance & {
                memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number };
              }
            ).memory
          : undefined;
      sendAnalyticsBeacon({
        name: "heartbeat",
        path: window.location.pathname,
        properties: {
          ...deviceProps(),
          kind: "pagehide",
          usedJSHeapSize: mem?.usedJSHeapSize ?? null,
          jsHeapSizeLimit: mem?.jsHeapSizeLimit ?? null,
        },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("pagehide", onPageHide);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      sendAnalyticsBeacon({
        name: "heartbeat",
        path: window.location.pathname,
        properties: { ...deviceProps(), kind: "alive" },
      });
    }, 60_000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(heartbeat);
    };
  }, []);

  return null;
}
