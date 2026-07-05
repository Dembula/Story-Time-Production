/**
 * PayFast production readiness smoke (no live charge).
 * Verifies credentials, demo mode off, notify URL, and checkout field signing.
 *
 * Usage: npx tsx scripts/payfast-production-smoke.ts
 * Optional: PAYFAST_SMOKE_ALLOW_DEMO=true to run when demo mode is on.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  getPaymentBaseUrl,
  getPayFastMerchantId,
  getPayFastMerchantKey,
  isPayFastPassphraseConfigured,
  payfastNotifyUrl,
  PAYFAST_PRODUCTION_ORIGIN,
} from "../src/lib/payments/providers/payfast-config";
import { getPaymentGatewayMode, isDemoPaymentsMode } from "../src/lib/payments/config";
import { generatePayFastCheckoutSignature } from "../src/lib/payments/providers/payfast-signature";

function loadEnvLocal() {
  for (const name of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function probeNotifyUrl(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payment_status=CANCELLED&m_payment_id=smoke-probe",
      signal: AbortSignal.timeout(12_000),
    });
    // PayFast ITN handler should reject unsigned payloads (401/400) — that proves reachability.
    return { ok: res.status < 500, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  loadEnvLocal();

  const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const warn: string[] = [];

  const demoMode = isDemoPaymentsMode();
  const gatewayMode = getPaymentGatewayMode();
  const allowDemo = process.env.PAYFAST_SMOKE_ALLOW_DEMO === "true";

  checks.push({
    name: "gateway_mode",
    ok: gatewayMode === "payfast",
    detail: `mode=${gatewayMode}`,
  });

  checks.push({
    name: "demo_mode_off",
    ok: !demoMode || allowDemo,
    detail: demoMode ? "PAYMENTS_DEMO_MODE=true (set PAYFAST_SMOKE_ALLOW_DEMO=true to override)" : "demo off",
  });

  try {
    const merchantId = getPayFastMerchantId();
    const merchantKey = getPayFastMerchantKey();
    checks.push({
      name: "merchant_credentials",
      ok: Boolean(merchantId && merchantKey),
      detail: `merchant_id=${merchantId.slice(0, 4)}…`,
    });
  } catch (e) {
    checks.push({
      name: "merchant_credentials",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  checks.push({
    name: "passphrase_configured",
    ok: isPayFastPassphraseConfigured(),
    detail: isPayFastPassphraseConfigured() ? "present" : "PAYFAST_PASSPHRASE missing",
  });

  const baseUrl = getPaymentBaseUrl();
  const notifyUrl = payfastNotifyUrl();
  const productionOrigin = process.env.NODE_ENV === "production";

  checks.push({
    name: "payment_base_url",
    ok: !productionOrigin || baseUrl === PAYFAST_PRODUCTION_ORIGIN,
    detail: baseUrl,
  });

  checks.push({
    name: "notify_url_origin",
    ok: notifyUrl.startsWith(PAYFAST_PRODUCTION_ORIGIN) || !productionOrigin,
    detail: notifyUrl,
  });

  // Signature round-trip (no network charge).
  try {
    const fields = {
      merchant_id: getPayFastMerchantId(),
      merchant_key: getPayFastMerchantKey(),
      amount: "1.00",
      item_name: "Story Time smoke",
      m_payment_id: `smoke_${Date.now()}`,
      notify_url: notifyUrl,
      return_url: `${baseUrl}/payments/return`,
      cancel_url: `${baseUrl}/payments/return?cancelled=1`,
    };
    const sig = generatePayFastCheckoutSignature(fields, process.env.PAYFAST_PASSPHRASE?.trim() || null);
    checks.push({
      name: "checkout_signature",
      ok: typeof sig === "string" && sig.length === 32,
      detail: `sig=${sig.slice(0, 8)}…`,
    });
  } catch (e) {
    checks.push({
      name: "checkout_signature",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  if (process.env.PAYFAST_SMOKE_PROBE_NOTIFY === "true") {
    const probe = await probeNotifyUrl(notifyUrl);
    checks.push({
      name: "notify_url_reachable",
      ok: probe.ok,
      detail: probe.status ? `HTTP ${probe.status}` : probe.error,
    });
  } else {
    warn.push("Set PAYFAST_SMOKE_PROBE_NOTIFY=true to POST-probe the ITN endpoint.");
  }

  const failed = checks.filter((c) => !c.ok);
  const report = {
    ok: failed.length === 0,
    gatewayMode,
    demoMode,
    baseUrl,
    notifyUrl,
    checks,
    warnings: warn,
    manualSteps: [
      "Create a R1 viewer subscription checkout on production (real card).",
      "Confirm ITN webhook updates PaymentRecord to COMPLETED.",
      "Confirm wallet/ledger reconciliation: npm run payments:reconcile (mismatches=0).",
      "Refund or cancel test subscription in PayFast dashboard if needed.",
    ],
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
