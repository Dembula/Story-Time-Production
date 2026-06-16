/**
 * Verify every Prisma model table exists in the connected database.
 * Uses physical @@map table names where defined.
 * Usage: npx tsx scripts/verify-db-tables.ts
 */
import { prisma } from "../src/lib/prisma";

/** Prisma model name → Postgres table name (from schema @@map or default). */
const TABLES: Record<string, string> = {
  PasswordResetToken: "password_reset_tokens",
  AnalyticsEvent: "analytics_events",
  AnalyticsDailyRollup: "analytics_daily_rollups",
  OpsIncident: "ops_incidents",
};

const DEFAULT_MODELS = [
  "Account",
  "Session",
  "VerificationToken",
  "User",
  "Content",
  "ContentEnrichment",
  "ContentScene",
  "WatchProgress",
  "StreamAsset",
  "ProjectToolProgress",
] as const;

async function main() {
  const missing: string[] = [];

  for (const model of DEFAULT_MODELS) {
    const table = TABLES[model] ?? model;
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
    } catch {
      missing.push(`${model} (${table})`);
    }
  }

  for (const [model, table] of Object.entries(TABLES)) {
    if (DEFAULT_MODELS.includes(model as (typeof DEFAULT_MODELS)[number])) continue;
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
    } catch {
      missing.push(`${model} (${table})`);
    }
  }

  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count
    FROM pg_tables
    WHERE schemaname = 'public'
  `;

  const migrationRows = await prisma.$queryRaw<
    Array<{ migration_name: string; finished_at: Date | null }>
  >`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 3`;

  console.log(
    JSON.stringify(
      {
        ok: missing.length === 0,
        publicTableCount: Number(count),
        missing,
        recentMigrations: migrationRows,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  if (missing.length) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
