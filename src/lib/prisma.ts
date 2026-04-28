import type { PrismaClient as PrismaClientType } from "../../generated/prisma";

const { PrismaClient } = require("../../generated/prisma") as {
  PrismaClient: new (options?: { log?: string[] }) => any;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

function createPrismaClient(): PrismaClientType {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }) as PrismaClientType;
}

let prisma: PrismaClientType = globalForPrisma.prisma ?? createPrismaClient();

// After `prisma generate`, new models exist on the generated client class but the dev-server
// global singleton may still be an older PrismaClient instance (missing delegates) → 500s.
// List delegates that must exist for the current schema; extend when new models ship.
const REQUIRED_PRISMA_DELEGATES = [
  "shootDayControlBoard",
  "creatorAccountProfileVault",
  "passwordResetToken",
  "analyticsEvent",
  "analyticsDailyRollup",
  "opsIncident",
  "adminAccessApplication",
  "userRole",
] as const;
function prismaSingletonIsStale(client: unknown): boolean {
  const c = client as Record<string, unknown>;
  return REQUIRED_PRISMA_DELEGATES.some((name) => typeof c[name] === "undefined");
}
if (process.env.NODE_ENV !== "production" && prisma && prismaSingletonIsStale(prisma)) {
  void prisma.$disconnect().catch(() => {});
  prisma = createPrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
