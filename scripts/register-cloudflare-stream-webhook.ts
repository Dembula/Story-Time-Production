/**
 * Register (or update) Cloudflare Stream VOD webhook for on-demand videos.
 * VOD webhooks are NOT in the Stream sidebar — they use the Stream API.
 *
 * Usage (from project root, with .env.local pulled from Vercel):
 *   npx tsx scripts/register-cloudflare-stream-webhook.ts
 *
 * Optional:
 *   npx tsx scripts/register-cloudflare-stream-webhook.ts --url https://story-time.online/api/stream/webhook
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    console.error("Could not read .env.local — run: vercel env pull .env.local --environment=production");
    process.exit(1);
  }
}

async function main() {
  loadEnvLocal();

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const notificationUrl =
    urlArg?.slice("--url=".length) ??
    process.env.STREAM_WEBHOOK_URL?.trim() ??
    "https://story-time.online/api/stream/webhook";

  if (!accountId || !apiToken) {
    console.error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_STREAM_API_TOKEN in .env.local");
    process.exit(1);
  }

  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/webhook`;

  const getRes = await fetch(base, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
  });
  const getBody = (await getRes.json().catch(() => ({}))) as {
    result?: { notification_url?: string; notificationUrl?: string; secret?: string };
  };
  if (getRes.ok && getBody.result) {
    const existing = getBody.result.notification_url ?? getBody.result.notificationUrl;
    console.log("Current webhook URL:", existing ?? "(none)");
    if (getBody.result.secret) {
      console.log("\nExisting signing secret (copy to Vercel as CLOUDFLARE_STREAM_WEBHOOK_SECRET):");
      console.log(getBody.result.secret);
    }
  }

  console.log("\nRegistering webhook URL:", notificationUrl);

  const putRes = await fetch(base, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notificationUrl }),
    cache: "no-store",
  });

  const putBody = (await putRes.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: { notification_url?: string; notificationUrl?: string; secret?: string };
  };

  if (!putRes.ok || !putBody.success) {
    console.error("Failed:", putBody.errors?.map((e) => e.message).join("; ") || putRes.status);
    process.exit(1);
  }

  const secret = putBody.result?.secret;
  const registered = putBody.result?.notification_url ?? putBody.result?.notificationUrl;

  console.log("\nSuccess. Registered:", registered);
  if (secret) {
    console.log("\n=== IMPORTANT: add this to Vercel (Production) ===");
    console.log("Variable name: CLOUDFLARE_STREAM_WEBHOOK_SECRET");
    console.log("Value (from Cloudflare — do NOT use the webhook URL):");
    console.log(secret);
    console.log("\nThen: vercel env pull .env.local --environment=production --yes");
    console.log("And redeploy production on Vercel.");
  } else {
    console.log("\nNo secret in response. Run GET on the same endpoint or check Cloudflare docs.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
