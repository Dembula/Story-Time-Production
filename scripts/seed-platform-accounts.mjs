import { hash } from "bcryptjs";

const { PrismaClient } = await import("../generated/prisma/index.js");
const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Storytime123!";

const ACCOUNTS = [
  { key: "admin", role: "ADMIN", email: "admin@storytime.local", name: "Story Time Admin" },
  { key: "viewer", role: "SUBSCRIBER", email: "viewer@storytime.local", name: "Story Time Viewer" },
  { key: "creator", role: "CONTENT_CREATOR", email: "creator@storytime.local", name: "Story Time Creator" },
  { key: "musicCreator", role: "MUSIC_CREATOR", email: "music@storytime.local", name: "Story Time Music Creator" },
  { key: "castingAgency", role: "CASTING_AGENCY", email: "casting@storytime.local", name: "Story Time Casting Agency" },
  { key: "crewTeam", role: "CREW_TEAM", email: "crew@storytime.local", name: "Story Time Crew Team" },
  { key: "locationOwner", role: "LOCATION_OWNER", email: "location@storytime.local", name: "Story Time Location Owner" },
  { key: "equipmentCompany", role: "EQUIPMENT_COMPANY", email: "equipment@storytime.local", name: "Story Time Equipment Company" },
  { key: "cateringCompany", role: "CATERING_COMPANY", email: "catering@storytime.local", name: "Story Time Catering Company" },
];

async function upsertUser(account, passwordHash) {
  const user = await prisma.user.upsert({
    where: { email: account.email },
    create: {
      email: account.email,
      name: account.name,
      role: account.role,
      passwordHash,
    },
    update: {
      name: account.name,
      role: account.role,
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: account.role } },
    create: { userId: user.id, role: account.role },
    update: {},
  });

  return user;
}

async function ensureCompanyArtifacts(usersByKey) {
  const casting = usersByKey.castingAgency;
  await prisma.castingAgency.upsert({
    where: { userId: casting.id },
    create: {
      userId: casting.id,
      agencyName: "Story Time Casting Agency",
      contactEmail: casting.email,
      city: "Johannesburg",
      country: "South Africa",
    },
    update: {
      agencyName: "Story Time Casting Agency",
      contactEmail: casting.email,
    },
  });

  const crew = usersByKey.crewTeam;
  await prisma.crewTeam.upsert({
    where: { userId: crew.id },
    create: {
      userId: crew.id,
      companyName: "Story Time Crew Team",
      contactEmail: crew.email,
      city: "Cape Town",
      country: "South Africa",
    },
    update: {
      companyName: "Story Time Crew Team",
      contactEmail: crew.email,
    },
  });

  const catering = usersByKey.cateringCompany;
  await prisma.cateringCompany.upsert({
    where: { userId: catering.id },
    create: {
      userId: catering.id,
      companyName: "Story Time Catering Co",
      contactEmail: catering.email,
      city: "Durban",
      country: "South Africa",
      minOrder: 750,
    },
    update: {
      companyName: "Story Time Catering Co",
      contactEmail: catering.email,
      minOrder: 750,
    },
  });
}

async function ensureWalletWithAvailable(userId, availableBalance) {
  const wallet = await prisma.wallet.upsert({
    where: { userId },
    create: {
      userId,
      availableBalance,
      pendingBalance: 0,
      lockedBalance: 0,
    },
    update: {
      availableBalance,
      pendingBalance: 0,
      lockedBalance: 0,
    },
  });

  const accounts = ["AVAILABLE", "PENDING", "LOCKED", "PLATFORM_REVENUE", "CREATOR_REVENUE"];
  for (const accountType of accounts) {
    const balance = accountType === "AVAILABLE" ? availableBalance : 0;
    await prisma.walletAccount.upsert({
      where: {
        walletId_accountType_currency: {
          walletId: wallet.id,
          accountType,
          currency: "ZAR",
        },
      },
      create: { walletId: wallet.id, accountType, currency: "ZAR", balance },
      update: { balance },
    });
  }
}

async function main() {
  const passwordHash = await hash(DEFAULT_PASSWORD, 10);
  const usersByKey = {};
  for (const account of ACCOUNTS) {
    usersByKey[account.key] = await upsertUser(account, passwordHash);
  }
  await ensureCompanyArtifacts(usersByKey);
  // Marketplace flows use creator wallet balance for pay confirmations.
  await ensureWalletWithAvailable(usersByKey.creator.id, 1500);
  await ensureWalletWithAvailable(usersByKey.admin.id, 0);

  console.log("Seeded platform credentials:");
  for (const account of ACCOUNTS) {
    console.log(`- ${account.role.padEnd(18)} ${account.email} / ${DEFAULT_PASSWORD}`);
  }
  console.log("- wallet bootstrap: creator available=R1500.00, admin available=R0.00");
}

main()
  .catch((error) => {
    console.error("seed-platform-accounts failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
