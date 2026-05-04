import fs from "node:fs";
import path from "node:path";

function readLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function main() {
  const env = readLocalEnv();
  const baseUrl = env.STITCH_API_BASE || process.env.STITCH_API_BASE || "https://api.stitch.money";
  const clientId = env.STITCH_CLIENT_ID || process.env.STITCH_CLIENT_ID;
  const clientSecret = env.STITCH_CLIENT_SECRET || process.env.STITCH_CLIENT_SECRET;
  const scope = env.STITCH_TOKEN_SCOPE || process.env.STITCH_TOKEN_SCOPE || "client_paymentrequest";
  const redirectUrl = env.STITCH_REDIRECT_URL || process.env.STITCH_REDIRECT_URL;
  const webhookUrl =
    env.STITCH_WEBHOOK_URL ||
    process.env.STITCH_WEBHOOK_URL ||
    `${env.NEXTAUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/payments/webhooks/stitch`;

  if (!clientId || !clientSecret) {
    throw new Error("Missing STITCH_CLIENT_ID or STITCH_CLIENT_SECRET.");
  }
  if (!redirectUrl) {
    throw new Error("Missing STITCH_REDIRECT_URL.");
  }

  const tokenRes = await fetch(`${baseUrl}/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, scope }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  const token = tokenJson?.data?.accessToken || tokenJson?.accessToken;
  if (!tokenRes.ok || !token) {
    throw new Error(`Failed to get Stitch token (${tokenRes.status}): ${JSON.stringify(tokenJson)}`);
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const redirectRes = await fetch(`${baseUrl}/api/v1/redirect-urls`, {
    method: "POST",
    headers,
    body: JSON.stringify({ redirectUrl }),
  });
  const redirectJson = await redirectRes.json().catch(() => ({}));

  const webhookRes = await fetch(`${baseUrl}/api/v1/webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url: webhookUrl }),
  });
  const webhookJson = await webhookRes.json().catch(() => ({}));
  const signingSecret = webhookJson?.data?.secret;

  console.log("Stitch bootstrap summary:");
  console.log(`- Redirect URL status: ${redirectRes.status}`);
  console.log(`- Webhook URL status: ${webhookRes.status}`);
  if (signingSecret) {
    console.log(`- New webhook signing secret: ${signingSecret}`);
    console.log("  Save this as STITCH_WEBHOOK_SECRET in .env.local");
  } else {
    console.log(`- Webhook response: ${JSON.stringify(webhookJson)}`);
  }
  if (!redirectRes.ok) {
    console.log(`- Redirect response: ${JSON.stringify(redirectJson)}`);
  }
}

main().catch((error) => {
  console.error("Stitch bootstrap failed:", error.message);
  process.exitCode = 1;
});

