import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUpstreamFairPlayCertificateUrl } from "@/lib/playback/drm-config";

export const runtime = "nodejs";

/**
 * Returns the Apple FairPlay Streaming application certificate (binary).
 *
 * The certificate is *not* secret, but we still gate it behind:
 *  - an authenticated viewer session,
 *  - per-IP rate limiting (mitigates scraping),
 *  - a TTL cache headers profile (short-lived to allow rotation).
 *
 * Apple's certification audit requires that the certificate is fetched over
 * HTTPS from the operator's own origin (never proxied through 3rd-party
 * JavaScript), which is why we expose this route directly.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit({
    key: "fp-cert",
    ip: req.headers.get("x-forwarded-for"),
    maxAttempts: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const upstream = resolveUpstreamFairPlayCertificateUrl();
  if (!upstream) {
    return NextResponse.json(
      { error: "FairPlay certificate is not configured" },
      { status: 404 },
    );
  }

  try {
    const res = await fetch(upstream, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream certificate fetch failed", status: res.status },
        { status: 502 },
      );
    }

    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, max-age=1800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("FairPlay certificate proxy error:", err);
    return NextResponse.json({ error: "Certificate fetch failed" }, { status: 500 });
  }
}
