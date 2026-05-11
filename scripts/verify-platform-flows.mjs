import { hash } from "bcryptjs";

const { PrismaClient } = await import("../generated/prisma/index.js");
const prisma = new PrismaClient();

const BASE_URL = process.env.FLOW_BASE_URL || "http://localhost:3001";
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Storytime123!";

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

async function ensureUser(email, role, name) {
  const passwordHash = await hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, role, name, passwordHash },
    update: { role, name, passwordHash },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role } },
    create: { userId: user.id, role },
    update: {},
  });
  return user;
}

async function loginCreatorLike(email, selectedRole) {
  const jar = new CookieJar();
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  jar.applySetCookies(csrfRes);
  const csrf = await csrfRes.json();
  const payload = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password: PASSWORD,
    callbackUrl: `${BASE_URL}/`,
    json: "true",
    selectedRole,
  });
  const signInRes = await fetch(`${BASE_URL}/api/auth/callback/credentials-creator`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.asHeader() },
    body: payload.toString(),
  });
  jar.applySetCookies(signInRes);
  return { jar, status: signInRes.status };
}

async function requestJson(jar, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
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

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

function checkoutOk(result) {
  return (
    result.status === 200 &&
    ((result.json?.requiresPayment === true && !!result.json?.checkoutUrl) ||
      result.json?.paymentMode === "wallet" ||
      result.json?.requiresPayment === false)
  );
}

async function main() {
  const creator = await ensureUser("creator@storytime.local", "CONTENT_CREATOR", "Story Time Creator");
  const agencyUser = await ensureUser("casting@storytime.local", "CASTING_AGENCY", "Story Time Casting");
  const equipmentUser = await ensureUser("equipment@storytime.local", "EQUIPMENT_COMPANY", "Story Time Equipment");
  const locationUser = await ensureUser("location@storytime.local", "LOCATION_OWNER", "Story Time Location");
  const crewUser = await ensureUser("crew@storytime.local", "CREW_TEAM", "Story Time Crew");
  const cateringUser = await ensureUser("catering@storytime.local", "CATERING_COMPANY", "Story Time Catering");

  const creatorLogin = await loginCreatorLike(creator.email, "CONTENT_CREATOR");
  check("creator_login", creatorLogin.status === 200, creatorLogin.status);

  const creatorUpload = await requestJson(creatorLogin.jar, "POST", "/api/creator/distribution-license", {
    package: "UPLOAD_ONLY",
  });
  check("creator_upload_checkout", checkoutOk(creatorUpload), creatorUpload);

  await prisma.creatorDistributionLicense.deleteMany({ where: { userId: creator.id } });
  const creatorPipeline = await requestJson(creatorLogin.jar, "POST", "/api/creator/distribution-license", {
    package: "PIPELINE",
    billing: "YEARLY",
  });
  check("creator_pipeline_checkout", checkoutOk(creatorPipeline), creatorPipeline);

  const roles = [
    ["CASTING_AGENCY", agencyUser],
    ["CREW_TEAM", crewUser],
    ["LOCATION_OWNER", locationUser],
    ["EQUIPMENT_COMPANY", equipmentUser],
    ["CATERING_COMPANY", cateringUser],
  ];
  for (const [role, user] of roles) {
    const login = await loginCreatorLike(user.email, role);
    check(`${role}_login`, login.status === 200, login.status);
    const sub = await requestJson(login.jar, "POST", "/api/company-subscription", { plan: "STANDARD" });
    check(`${role}_company_checkout`, checkoutOk(sub), sub);
  }

  const agency = await prisma.castingAgency.upsert({
    where: { userId: agencyUser.id },
    create: { userId: agencyUser.id, agencyName: "Story Time Casting", contactEmail: agencyUser.email },
    update: {},
  });
  const inquiry = await prisma.castingInquiry.create({
    data: {
      creatorId: creator.id,
      agencyId: agency.id,
      status: "PENDING",
      projectName: "Flow Audit Project",
      roleName: "Lead",
      message: "Flow audit inquiry",
    },
  });
  const castPay = await requestJson(creatorLogin.jar, "POST", `/api/casting-agency/inquiries/${inquiry.id}/pay`, {});
  const marketplaceFlowOk =
    checkoutOk(castPay) ||
    (castPay.status === 402 &&
      typeof castPay.json?.error === "string" &&
      castPay.json.error.toLowerCase().includes("insufficient wallet balance"));
  check("marketplace_casting_pay", marketplaceFlowOk, castPay);

  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.name} | ${JSON.stringify(c.detail)}`);
  if (checks.some((c) => !c.ok)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("verify-platform-flows failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
