import type { PrismaClient as PrismaClientType } from "../../generated/prisma";

const { PrismaClient } = require("../../generated/prisma") as {
  PrismaClient: new (options?: {
    log?: string[];
    datasources?: { db?: { url?: string } };
  }) => any;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

/**
 * Harden DATABASE_URL for serverless: one connection per isolate + short timeouts.
 * Prefer Neon pooler (port 6543 / `-pooler` host) in production env.
 */
function resolveDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "10");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "10");
    }
    if (!url.searchParams.has("pgbouncer") && (url.port === "6543" || url.hostname.includes("-pooler"))) {
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient(): PrismaClientType {
  const url = resolveDatasourceUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
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
  "promoCode",
  "promoCodeRedemption",
  "creatorCalendarEvent",
  "notification",
  "creatorStudioTeamInvite",
  "studioCompany",
  "creatorStudioProfile",
  "projectScene",
  "projectBudgets",
  "callSheet",
  "projectTask",
  "breakdownCharacter",
  "castingRole",
  "crewRoleNeed",
  "modocConversation",
  "modocMessage",
  "modocPlaybookRule",
  "modocActionLog",
  "modocTopicStat",
  "modocSessionIntel",
  "knowledgeChunk",
  "knowledgeEdge",
  "aiRequestLog",
  "adminAuditLog",
  "creatorScriptImport",
] as const;
function prismaSingletonIsStale(client: unknown): boolean {
  if (typeof window !== "undefined") return false;
  const c = client as Record<string, unknown>;
  return REQUIRED_PRISMA_DELEGATES.some((name) => typeof c[name] === "undefined");
}
if (prisma && prismaSingletonIsStale(prisma)) {
  void prisma.$disconnect().catch(() => {});
  prisma = createPrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
