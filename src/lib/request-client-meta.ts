import type { NextRequest } from "next/server";
import { inferDeviceTypeFromUserAgent } from "@/lib/client-device-type";

/**
 * Resolves the visitor’s public IP from request headers set by **trusted edges**
 * (CDN / host). No Docker or nginx is required if you only use **Cloudflare**
 * with the **orange-cloud (proxied)** DNS record: Cloudflare terminates the
 * connection and adds **`CF-Connecting-IP`** with the real visitor IP. We read
 * that header **first** so Story Time matches Cloudflare’s view of the client.
 *
 * Fallback order covers other hosts (e.g. `X-Forwarded-For` on Vercel) if the
 * request did not pass through Cloudflare’s proxy.
 */
export function getClientIpFromRequest(req: NextRequest): string | null {
  const h = req.headers;

  // 1) Cloudflare (orange cloud) — preferred when you only front the app with CF
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  // 2) Common forwarding chain (first hop ≈ original client when edge appends correctly)
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  // 3) Vercel (when present)
  const vercelForwarded = h.get("x-vercel-forwarded-for")?.trim();
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const otherSingle = [
    "true-client-ip",
    "fastly-client-ip",
    "x-real-ip",
    "x-client-ip",
    "x-cluster-client-ip",
  ] as const;
  for (const name of otherSingle) {
    const v = h.get(name)?.trim();
    if (v) return v;
  }

  return null;
}

export function getUserAgentFromRequest(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}

export function getDeviceTypeForRequest(req: NextRequest): string {
  return inferDeviceTypeFromUserAgent(getUserAgentFromRequest(req));
}
