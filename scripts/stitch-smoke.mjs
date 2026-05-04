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

function pickToken(json) {
  return json?.data?.accessToken || json?.accessToken || null;
}

function mask(input) {
  if (!input || typeof input !== "string") return "n/a";
  if (input.length < 10) return "***";
  return `${input.slice(0, 5)}...${input.slice(-4)}`;
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

async function stitchCall(base, token, method, route, body) {
  const res = await fetch(`${base}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const payload = await safeJson(res);
  return { status: res.status, ...payload };
}

function printResult(label, result) {
  const ok = result.status >= 200 && result.status < 300;
  const hint = ok ? "PASS" : "FAIL";
  const message =
    result.json?.message ||
    result.json?.error ||
    result.json?.generalErrors?.[0] ||
    (result.text ? String(result.text).slice(0, 180) : "");
  console.log(`${hint} | ${label} | status=${result.status}${message ? ` | ${message}` : ""}`);
}

async function main() {
  const env = readLocalEnv();
  const base = env.STITCH_API_BASE || process.env.STITCH_API_BASE || "https://express.stitch.money";
  const clientId = env.STITCH_CLIENT_ID || process.env.STITCH_CLIENT_ID;
  const clientSecret = env.STITCH_CLIENT_SECRET || process.env.STITCH_CLIENT_SECRET;
  const payScope = env.STITCH_TOKEN_SCOPE || process.env.STITCH_TOKEN_SCOPE || "client_paymentrequest";
  const consentScope = env.STITCH_CONSENT_SCOPE || process.env.STITCH_CONSENT_SCOPE || "client_recurringpaymentconsentrequest";

  if (!clientId || !clientSecret) {
    throw new Error("Missing STITCH_CLIENT_ID or STITCH_CLIENT_SECRET.");
  }

  console.log(`Using Stitch base: ${base}`);
  console.log(`Client ID: ${mask(clientId)}`);

  const tokenRes = await fetch(`${base}/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, scope: payScope }),
  });
  const tokenPayload = await safeJson(tokenRes);
  const payToken = pickToken(tokenPayload.json);
  if (!payToken) {
    throw new Error(`Unable to get payment token (${tokenRes.status}): ${tokenPayload.text}`);
  }
  console.log("PASS | token(client_paymentrequest)");

  const accountBalance = await stitchCall(base, payToken, "GET", "/api/v1/account/balance");
  const accountBank = await stitchCall(base, payToken, "GET", "/api/v1/account/bank-details");
  const fees = await stitchCall(base, payToken, "GET", "/api/v1/fees");
  const payments = await stitchCall(base, payToken, "GET", "/api/v1/payment");
  const paymentLinks = await stitchCall(base, payToken, "GET", "/api/v1/payment-links?limit=5");
  const refunds = await stitchCall(base, payToken, "GET", "/api/v1/refunds");
  const redirects = await stitchCall(base, payToken, "GET", "/api/v1/redirect-urls");

  printResult("account/balance", accountBalance);
  printResult("account/bank-details", accountBank);
  printResult("fees", fees);
  printResult("payment(list)", payments);
  printResult("payment-links(list)", paymentLinks);
  printResult("refunds(list)", refunds);
  printResult("redirect-urls(list)", redirects);

  const consentTokenRes = await fetch(`${base}/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, scope: consentScope }),
  });
  const consentTokenPayload = await safeJson(consentTokenRes);
  const consentToken = pickToken(consentTokenPayload.json);
  if (consentToken) {
    console.log("PASS | token(client_recurringpaymentconsentrequest)");
    const subscriptions = await stitchCall(base, consentToken, "GET", "/api/v1/subscriptions");
    printResult("subscriptions(list)", subscriptions);
  } else {
    console.log(
      `WARN | token(client_recurringpaymentconsentrequest) not available | status=${consentTokenRes.status} | ${
        consentTokenPayload.json?.message || consentTokenPayload.text
      }`,
    );
  }

  console.log("Smoke test complete.");
}

main().catch((error) => {
  console.error("Stitch smoke test failed:", error.message);
  process.exitCode = 1;
});
