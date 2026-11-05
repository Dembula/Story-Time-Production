import "server-only";

import { createSign } from "node:crypto";

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

function normalizePrivateKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function loadGooglePlayServiceAccount(): ServiceAccountCreds | null {
  const jsonRaw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Partial<ServiceAccountCreds>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: normalizePrivateKey(parsed.private_key),
        };
      }
    } catch {
      // fall through to discrete env vars
    }
  }

  const email = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !key) return null;
  return { client_email: email, private_key: normalizePrivateKey(key) };
}

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function mintAccessToken(creds: ServiceAccountCreds): Promise<{
  accessToken: string;
  expiresAtMs: number;
}> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(creds.private_key));
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Google OAuth token failed (${res.status})`,
    );
  }
  const expiresIn = Number(json.expires_in ?? 3600);
  return {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
}

export async function getGooglePlayAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) {
    return cachedToken.accessToken;
  }
  const creds = loadGooglePlayServiceAccount();
  if (!creds) {
    throw new Error("Google Play service account credentials are not configured.");
  }
  cachedToken = await mintAccessToken(creds);
  return cachedToken.accessToken;
}
