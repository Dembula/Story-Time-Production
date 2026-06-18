#!/usr/bin/env node
/**
 * Production-safe Prisma migrate deploy for Neon + Vercel.
 *
 * - Requires DIRECT_URL (non-pooler) for DDL / advisory locks
 * - Retries when another deploy holds pg_advisory_lock (P1002)
 */
import { spawnSync } from "node:child_process";

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 12_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikePoolerUrl(url) {
  if (!url) return false;
  return url.includes("-pooler.") || url.includes(":6543/");
}

function validateDatabaseUrls() {
  const direct = process.env.DIRECT_URL?.trim() ?? "";
  const pooled = process.env.DATABASE_URL?.trim() ?? "";

  if (!direct) {
    console.warn(
      "[migrate] WARNING: DIRECT_URL is not set. Prisma will fall back to DATABASE_URL for migrations.",
    );
    console.warn(
      "[migrate] On Neon, set DIRECT_URL to the direct endpoint (host without -pooler, port 5432).",
    );
    return;
  }

  if (looksLikePoolerUrl(direct)) {
    console.error("[migrate] ERROR: DIRECT_URL looks like a PgBouncer/pooler URL.");
    console.error("[migrate] Use Neon's direct connection string for migrations (port 5432, no -pooler).");
    console.error("[migrate] Example:");
    console.error(
      "[migrate]   DIRECT_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require",
    );
    process.exit(1);
  }

  if (direct === pooled && looksLikePoolerUrl(pooled)) {
    console.error("[migrate] ERROR: DATABASE_URL and DIRECT_URL are both pooler URLs.");
    process.exit(1);
  }
}

function runMigrateDeploy() {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  return result.status ?? 1;
}

async function main() {
  validateDatabaseUrls();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[migrate] prisma migrate deploy (attempt ${attempt}/${MAX_ATTEMPTS})`);

    const code = runMigrateDeploy();
    if (code === 0) {
      console.log("[migrate] migrations applied successfully");
      process.exit(0);
    }

    if (attempt >= MAX_ATTEMPTS) {
      console.error("[migrate] migrate deploy failed after all retries");
      console.error("[migrate] If P1002 persists:");
      console.error("[migrate]   1. Confirm Vercel DIRECT_URL is Neon's direct endpoint (5432, no -pooler)");
      console.error("[migrate]   2. Ensure only one deploy is running migrations at a time");
      console.error("[migrate]   3. Run: npx prisma migrate deploy locally with DIRECT_URL set");
      process.exit(code || 1);
    }

    console.warn(
      `[migrate] attempt ${attempt} failed — retrying in ${RETRY_DELAY_MS / 1000}s (common when parallel Vercel builds hold the advisory lock)`,
    );
    await sleep(RETRY_DELAY_MS);
  }
}

main().catch((err) => {
  console.error("[migrate] unexpected error", err);
  process.exit(1);
});
