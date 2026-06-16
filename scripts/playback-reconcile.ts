/**
 * Story Time — Manual playback reconciler.
 *
 * Drains any Cloudflare Stream upload whose webhook never fired and
 * re-syncs the associated catalogue row(s). Mirrors what the
 * `/api/cron/playback-reconcile` route does, but runs from a terminal so an
 * operator can recover content without waiting for the next cron tick.
 *
 * Usage:  npx tsx scripts/playback-reconcile.ts [--max=200]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { reconcileStuckStreamAssets } from "../src/lib/playback/stream-reconciler";
import { prisma } from "../src/lib/prisma";

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
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
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const max = Number(
    process.argv.find((arg) => arg.startsWith("--max="))?.split("=")[1] ?? "100",
  );
  const result = await reconcileStuckStreamAssets({ maxRows: max });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
