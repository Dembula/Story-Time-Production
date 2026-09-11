/** Lightweight client → admin beacon for page activity and crash signals (auth optional). */

export const PUBLIC_ANALYTICS_EVENT_NAMES = [
  "page_view",
  "heartbeat",
  "client_error",
  "web_crash",
] as const;

export type PublicAnalyticsEventName = (typeof PUBLIC_ANALYTICS_EVENT_NAMES)[number];

export function isPublicAnalyticsEventName(name: string): name is PublicAnalyticsEventName {
  return (PUBLIC_ANALYTICS_EVENT_NAMES as readonly string[]).includes(name);
}

export type AnalyticsBeaconPayload = {
  name: string;
  path?: string;
  properties?: Record<string, unknown>;
  clientTs?: string;
};

/** Fire-and-forget beacon; prefers sendBeacon so crashes still report. */
export function sendAnalyticsBeacon(payload: AnalyticsBeaconPayload): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    name: payload.name,
    path: payload.path ?? window.location.pathname,
    properties: payload.properties ?? {},
    clientTs: payload.clientTs ?? new Date().toISOString(),
  });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics/beacon", blob)) return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch("/api/analytics/beacon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
