import "server-only";

import {
  inferDeviceTypeFromPlatformHeader,
  inferDeviceTypeFromUserAgent,
} from "@/lib/client-device-type";

/**
 * Best-effort IP + device from the active Next.js request (auth events, route handlers).
 * Safe when called outside a request: returns empty fields instead of throwing.
 */
export async function getActivityMetaFromHeaders(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string;
  platform: string | null;
}> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ip =
      h.get("cf-connecting-ip")?.trim() ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip")?.trim() ||
      null;
    const userAgent = h.get("user-agent");
    const platform = h.get("x-st-platform")?.trim() || null;
    const deviceType =
      inferDeviceTypeFromPlatformHeader(platform) ?? inferDeviceTypeFromUserAgent(userAgent);
    return { ipAddress: ip, userAgent, deviceType, platform };
  } catch {
    return { ipAddress: null, userAgent: null, deviceType: "unknown", platform: null };
  }
}
