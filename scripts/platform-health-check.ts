/**
 * Pre-deploy health check: env, database, Cloudflare Stream, critical migrations.
 * Usage: npx tsx scripts/platform-health-check.ts
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { prisma } from "../src/lib/prisma";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
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

async function main() {
  loadEnvLocal();
  const failures: string[] = [];

  const requiredEnv = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  for (const key of requiredEnv) {
    if (!process.env[key]?.trim()) failures.push(`missing env: ${key}`);
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    failures.push("database connection failed");
  }

  const tables = ["WatchProgress", "StreamAsset", "ProjectToolProgress", "ContentEnrichment"] as const;
  for (const table of tables) {
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
    } catch {
      failures.push(`missing or inaccessible table: ${table} (run prisma migrate deploy)`);
    }
  }

  try {
    execSync("npx tsx scripts/verify-cloudflare-setup.ts", {
      stdio: "pipe",
      encoding: "utf8",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`cloudflare verify failed: ${msg.slice(0, 200)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        failures,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  if (failures.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
