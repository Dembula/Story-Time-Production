import { PrismaClient } from "../generated/prisma/index.js";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

class Jar {
  constructor() {
    this.cookies = new Map();
  }

  apply(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      const first = cookie.split(";", 1)[0];
      const idx = first.indexOf("=");
      if (idx > 0) this.cookies.set(first.slice(0, idx), first.slice(idx + 1));
    }
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function main() {
  const email = "live.trace.viewer@example.com";
  const pass = "TracePass!234";
  const passwordHash = await hash(pass, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Live Trace Viewer", role: "SUBSCRIBER", passwordHash },
    update: { role: "SUBSCRIBER", passwordHash },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: "SUBSCRIBER" } },
    create: { userId: user.id, role: "SUBSCRIBER" },
    update: {},
  });
  await prisma.viewerSubscription.deleteMany({ where: { userId: user.id } });

  const jar = new Jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.apply(csrfRes);
  const csrf = await csrfRes.json();

  const loginPayload = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password: pass,
    callbackUrl: `${BASE}/`,
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials-viewer`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.header() },
    body: loginPayload.toString(),
  });
  jar.apply(loginRes);
  const loginJson = await loginRes.json().catch(() => ({}));

  const payRes = await fetch(`${BASE}/api/viewer/subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: jar.header() },
    body: JSON.stringify({ viewerModel: "SUBSCRIPTION", plan: "BASE_1", startTrial: false }),
  });
  const payJson = await payRes.json().catch(() => ({}));

  const record = await prisma.paymentRecord.findFirst({
    where: { userId: user.id, purpose: "viewer_subscription" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, provider: true, amount: true, metadata: true, createdAt: true },
  });

  let checkoutHost = null;
  try {
    checkoutHost = new URL(payJson.checkoutUrl).host;
  } catch {}

  console.log(
    JSON.stringify(
      {
        loginStatus: loginRes.status,
        loginPayload: loginJson,
        paymentStatus: payRes.status,
        requiresPayment: payJson.requiresPayment,
        checkoutUrl: payJson.checkoutUrl,
        checkoutHost,
        isStitchHosted: typeof payJson.checkoutUrl === "string" && payJson.checkoutUrl.includes("stitch.money"),
        paymentRecord: record,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

