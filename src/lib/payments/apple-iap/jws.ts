import "server-only";

import { createVerify, X509Certificate, type KeyObject } from "node:crypto";
import { allowedAppleBundleIds } from "@/lib/payments/apple-iap/products";

export type AppleTransactionPayload = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId?: string;
  environment?: string;
  purchaseDate?: number;
  originalPurchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  type?: string;
  inAppOwnershipType?: string;
  transactionReason?: string;
  storefront?: string;
  signedDate?: number;
  [key: string]: unknown;
};

export type VerifiedAppleTransaction = {
  payload: AppleTransactionPayload;
  jws: string;
  environment: "Sandbox" | "Production" | "Xcode" | string;
};

function b64urlJson<T>(part: string): T {
  const json = Buffer.from(part, "base64url").toString("utf8");
  return JSON.parse(json) as T;
}

/** Decode StoreKit 2 / App Store Server API signed transaction JWS (no crypto). */
export function decodeAppleJwsPayload(jws: string): AppleTransactionPayload {
  const parts = jws.trim().split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Apple transaction JWS");
  }
  const payload = b64urlJson<AppleTransactionPayload>(parts[1]);
  if (!payload?.transactionId || !payload?.productId) {
    throw new Error("Apple JWS missing transactionId or productId");
  }
  return payload;
}

/**
 * Verify StoreKit 2 JWS using the embedded x5c certificate chain (ES256).
 * Production should also set APPLE_IAP_BUNDLE_IDS to your app bundle IDs.
 */
export function verifyAppleTransactionJws(jws: string): VerifiedAppleTransaction {
  const raw = jws.trim();
  const parts = raw.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Apple transaction JWS");
  }

  const [headerB64, payloadB64, sigB64] = parts;
  const header = b64urlJson<{ alg?: string; x5c?: string[] }>(headerB64);
  const payload = b64urlJson<AppleTransactionPayload>(payloadB64);

  if (!payload.transactionId || !payload.productId) {
    throw new Error("Apple JWS missing transactionId or productId");
  }

  if (payload.revocationDate) {
    throw new Error("Apple transaction has been revoked");
  }

  const allowUnverified =
    process.env.APPLE_IAP_ALLOW_UNVERIFIED === "true" &&
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production";

  if (allowUnverified) {
    return {
      payload,
      jws: raw,
      environment: String(payload.environment ?? "Sandbox"),
    };
  }

  if (header.alg !== "ES256") {
    throw new Error(`Unsupported Apple JWS alg: ${header.alg ?? "none"}`);
  }

  const leafDer = header.x5c?.[0];
  if (!leafDer) {
    throw new Error("Apple JWS missing certificate chain (x5c)");
  }
  if (!header.x5c || header.x5c.length < 2) {
    throw new Error("Apple JWS certificate chain too short (need leaf + intermediate)");
  }

  const cert = new X509Certificate(Buffer.from(leafDer, "base64"));
  const intermediate = new X509Certificate(Buffer.from(header.x5c[1], "base64"));
  // Basic chain integrity: leaf must be issued by the embedded intermediate.
  // Full Apple Root CA pinning can be layered on when APPLE_IAP_ROOT_CERT_PEM is configured.
  try {
    if (typeof (cert as { checkIssued?: (issuer: X509Certificate) => boolean }).checkIssued === "function") {
      const issued = (cert as { checkIssued: (issuer: X509Certificate) => boolean }).checkIssued(intermediate);
      if (!issued) {
        throw new Error("Apple JWS leaf is not issued by the provided intermediate certificate");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("not issued")) throw err;
    // Older Node builds may lack checkIssued — continue with signature verify on leaf.
  }

  // Node 22+: cert.publicKey is already a PublicKeyObject. Passing it to
  // createPublicKey() throws "Invalid key object type public, expected private"
  // and was breaking iOS subscribe / restore after Apple charged the user.
  const keyObject = cert.publicKey as KeyObject;
  const verifier = createVerify("SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = Buffer.from(sigB64, "base64url");
  let ok = false;
  try {
    ok = verifier.verify(
      {
        key: keyObject,
        dsaEncoding: "ieee-p1363",
      },
      signature,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown crypto error";
    throw new Error(`Apple JWS signature verification failed (${detail})`);
  }
  if (!ok) {
    throw new Error("Apple JWS signature verification failed");
  }

  const allowed = allowedAppleBundleIds();
  const bundleId = typeof payload.bundleId === "string" ? payload.bundleId : "";
  if (allowed.length > 0) {
    if (!bundleId || !allowed.includes(bundleId)) {
      throw new Error(bundleId ? `Apple bundleId not allowed: ${bundleId}` : "Apple JWS missing bundleId");
    }
  }

  return {
    payload,
    jws: raw,
    environment: String(payload.environment ?? "Production"),
  };
}

/** Resolve JWS from common client field names. */
export function pickAppleJws(body: Record<string, unknown>): string | null {
  const candidates = [
    body.signedTransactionInfo,
    body.jwsRepresentation,
    body.signedTransaction,
    body.signedPayload,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().split(".").length === 3) return c.trim();
  }
  return null;
}

export function periodEndFromApplePayload(
  payload: AppleTransactionPayload,
  billingInterval: "month" | "year",
  from: Date = new Date(),
): Date {
  if (typeof payload.expiresDate === "number" && payload.expiresDate > 0) {
    return new Date(payload.expiresDate);
  }
  const next = new Date(from);
  if (billingInterval === "year") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}
