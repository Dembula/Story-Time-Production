import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const { PrismaClient } = await import("../generated/prisma/index.js");
const prisma = new PrismaClient();

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const CHECK_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Storytime123!";
const CREATOR_EMAIL = "creator@storytime.local";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  applySetCookies(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      const first = cookie.split(";", 1)[0];
      const idx = first.indexOf("=");
      if (idx <= 0) continue;
      this.cookies.set(first.slice(0, idx), first.slice(idx + 1));
    }
  }
  asHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function loginCreator(email, password) {
  const jar = new CookieJar();
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  jar.applySetCookies(csrfRes);
  const csrf = await csrfRes.json();
  const payload = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
    callbackUrl: `${BASE_URL}/`,
    json: "true",
    selectedRole: "CONTENT_CREATOR",
  });
  const signInRes = await fetch(`${BASE_URL}/api/auth/callback/credentials-creator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.asHeader(),
    },
    body: payload.toString(),
  });
  jar.applySetCookies(signInRes);
  return { jar, status: signInRes.status };
}

async function requestJson(jar, method, route, body) {
  const res = await fetch(`${BASE_URL}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jar ? { Cookie: jar.asHeader() } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function main() {
  const env = readLocalEnv();
  const webhookSecret = env.STITCH_WEBHOOK_SECRET || process.env.STITCH_WEBHOOK_SECRET || "";
  assert(webhookSecret, "Missing STITCH_WEBHOOK_SECRET for webhook simulation.");

  const creator = await prisma.user.findUnique({
    where: { email: CREATOR_EMAIL },
    select: { id: true, email: true },
  });
  assert(creator?.id, "Seeded creator user not found.");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, email: true },
  });
  assert(admin?.id, "Admin user not found.");

  const creatorWalletBefore = await prisma.wallet.findUnique({ where: { userId: creator.id } });
  const adminWalletBefore = await prisma.wallet.findUnique({ where: { userId: admin.id } });

  const login = await loginCreator(creator.email, CHECK_PASSWORD);
  assert(login.status === 200, `Creator login failed (${login.status}).`);

  await prisma.creatorDistributionLicense.deleteMany({ where: { userId: creator.id } });
  const checkout = await requestJson(login.jar, "POST", "/api/creator/distribution-license", {
    package: "UPLOAD_ONLY",
  });
  assert(checkout.status === 200, `Creator checkout init failed (${checkout.status}): ${checkout.json?.error || ""}`);
  assert(checkout.json?.requiresPayment === true, "Creator checkout did not require payment as expected.");

  const latestPayment = await prisma.paymentRecord.findFirst({
    where: { userId: creator.id, purpose: "creator_distribution_license" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, amount: true },
  });
  assert(latestPayment?.id, "No payment record created for creator onboarding.");

  const ref = await prisma.gatewayReference.findFirst({
    where: {
      provider: "STITCH",
      metadata: { path: ["paymentRecordId"], equals: latestPayment.id },
    },
    select: { externalRef: true },
  });
  assert(ref?.externalRef, "Missing gateway reference for creator payment.");

  const payload = {
    id: `evt_money_audit_${Date.now()}`,
    type: "payment.succeeded",
    data: { reference: ref.externalRef },
  };
  const raw = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", webhookSecret).update(raw).digest("hex");
  const webhookRes = await fetch(`${BASE_URL}/api/payments/webhooks/stitch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-stitch-signature": signature,
    },
    body: raw,
  });
  const webhookJson = await webhookRes.json().catch(() => ({}));
  assert(webhookRes.status === 200 && webhookJson?.ok, "Webhook settlement simulation failed.");

  const settled = await prisma.paymentRecord.findUnique({
    where: { id: latestPayment.id },
    select: { status: true },
  });
  assert(settled?.status === "SUCCEEDED", "Payment record did not settle to SUCCEEDED.");

  const creatorWalletAfter = await prisma.wallet.findUnique({ where: { userId: creator.id } });
  const adminWalletAfter = await prisma.wallet.findUnique({ where: { userId: admin.id } });

  const creatorBefore = Number(creatorWalletBefore?.availableBalance ?? 0);
  const creatorAfter = Number(creatorWalletAfter?.availableBalance ?? 0);
  const adminBefore = Number(adminWalletBefore?.availableBalance ?? 0);
  const adminAfter = Number(adminWalletAfter?.availableBalance ?? 0);
  const amount = Number(latestPayment.amount ?? 0);

  // Core requirement: payer should NOT receive their own payment amount.
  assert(creatorAfter - creatorBefore < amount - 0.0001, "Creator wallet was incorrectly credited with own payment.");
  // Platform (admin treasury) should reflect inflow.
  assert(adminAfter - adminBefore >= amount - 0.0001, "Platform/admin wallet did not receive expected inflow.");

  console.log("PASS | creator payment settled to platform treasury");
  console.log(
    JSON.stringify(
      {
        paymentRecordId: latestPayment.id,
        amount,
        creatorAvailableBefore: creatorBefore,
        creatorAvailableAfter: creatorAfter,
        adminAvailableBefore: adminBefore,
        adminAvailableAfter: adminAfter,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("audit-money-flow failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
