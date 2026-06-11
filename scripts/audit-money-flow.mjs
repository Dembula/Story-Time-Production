const { PrismaClient } = await import("../generated/prisma/index.js");
const prisma = new PrismaClient();

const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const CHECK_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Storytime123!";
const CREATOR_EMAIL = "creator@storytime.local";

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

  console.log("SKIP | webhook settlement simulation (PayFast ITN not integrated yet)");
  console.log(
    JSON.stringify(
      {
        paymentRecordId: latestPayment.id,
        status: latestPayment.status,
        note: "Checkout creation verified; gateway settlement requires PayFast integration.",
      },
      null,
      2,
    ),
  );

  console.log("PASS | creator checkout initialized pending PayFast settlement");
}

main()
  .catch((error) => {
    console.error("audit-money-flow failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
