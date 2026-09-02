/**
 * Apply browser upload CORS to the Storytime media bucket.
 *
 * Requires STORAGE_* / S3_* env vars (same as the app).
 * Usage: npx tsx scripts/apply-s3-cors.ts
 *
 * Direct browser PUTs (poster, backdrop, main video, etc.) need PUT + OPTIONS
 * from your app origin. Without this, XHR uploads fail with a CORS/network error.
 *
 * Always includes the production canonical domains (story-time.online). Creators
 * upload from that origin — never only the *.vercel.app preview host.
 *
 * Production also self-heals via ensureStorageBucketCors on every upload init.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ensureStorageBucketCors, resolveStorageCorsOrigins } from "../src/lib/storage-cors";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  const origins = resolveStorageCorsOrigins();
  const result = await ensureStorageBucketCors({ force: true });

  if (!result.ok) {
    console.error(`\nCould not apply CORS with the current AWS credentials.\n`);
    console.error(`Bucket: s3://${result.bucket ?? "(unknown)"}`);
    console.error(`Required permission: s3:PutBucketCORS`);
    console.error(`\nFastest fix (AWS Console, ~30s):`);
    console.error(
      `1. Open the bucket Permissions → Cross-origin resource sharing (CORS) → Edit`,
    );
    console.error(`2. Paste deploy/connection-pack/s3-cors.json and Save`);
    console.error(`\nAllowedOrigins that must be present:\n  - ${origins.join("\n  - ")}\n`);
    if (result.error) console.error(result.error);
    process.exit(1);
  }

  console.log(`Applied CORS to s3://${result.bucket}`);
  console.log(`AllowedOrigins: ${result.origins.join(", ")}`);
  console.log(JSON.stringify(result.rules ?? [], null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
