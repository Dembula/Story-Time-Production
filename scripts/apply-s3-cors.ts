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
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { getStorageConfig } from "../src/lib/storage-config";

/** Origins that must always be allowed — independent of local/.env NEXTAUTH_URL. */
const CANONICAL_PRODUCTION_ORIGINS = [
  "https://story-time.online",
  "https://www.story-time.online",
  "https://story-time-production.vercel.app",
] as const;

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

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function isValidOrigin(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function originsFromEnv(): string[] {
  const configured = [
    ...CANONICAL_PRODUCTION_ORIGINS,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:3000",
    "https://localhost:3000",
  ]
    .map((v) => (typeof v === "string" ? normalizeOrigin(v) : ""))
    .filter(Boolean)
    .filter(isValidOrigin);

  const extra = (process.env.STORAGE_CORS_ORIGINS || process.env.S3_CORS_ORIGINS || "")
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean)
    .filter(isValidOrigin);

  return Array.from(new Set([...configured, ...extra]));
}

async function main() {
  const storage = getStorageConfig();
  if (!storage.bucket || !storage.region) {
    throw new Error("Set STORAGE_BUCKET_NAME and STORAGE_REGION (or S3_* equivalents).");
  }

  // Prefer admin keys when present (uploader IAM is often least-privilege without PutBucketCORS).
  const accessKeyId =
    process.env.STORAGE_ADMIN_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    storage.accessKeyId;
  const secretAccessKey =
    process.env.STORAGE_ADMIN_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
    storage.secretAccessKey;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "Set STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY (or STORAGE_ADMIN_* / AWS_* with s3:PutBucketCORS).",
    );
  }

  const origins = originsFromEnv();
  if (origins.length === 0) {
    throw new Error("No AllowedOrigins resolved. Set NEXT_PUBLIC_APP_URL or STORAGE_CORS_ORIGINS.");
  }

  for (const must of CANONICAL_PRODUCTION_ORIGINS) {
    if (!origins.includes(must)) {
      throw new Error(`Internal error: missing canonical origin ${must}`);
    }
  }

  const client = new S3Client({
    region: storage.region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    ...(storage.endpoint ? { endpoint: storage.endpoint, forcePathStyle: true } : {}),
  });

  const corsRules = [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "HEAD", "PUT", "POST"],
      AllowedOrigins: origins,
      ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
      MaxAgeSeconds: 3000,
    },
  ];

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: storage.bucket,
        CORSConfiguration: { CORSRules: corsRules },
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/PutBucketCORS|AccessDenied|not authorized/i.test(message)) {
      console.error(`\nCould not apply CORS with the current AWS credentials.\n`);
      console.error(`Bucket: s3://${storage.bucket}`);
      console.error(`Required permission: s3:PutBucketCORS`);
      console.error(`\nFastest fix (AWS Console, ~30s):`);
      console.error(
        `1. Open https://s3.console.aws.amazon.com/s3/buckets/${storage.bucket}?region=${storage.region}&tab=permissions`,
      );
      console.error(`2. Scroll to Cross-origin resource sharing (CORS) → Edit`);
      console.error(`3. Paste deploy/connection-pack/s3-cors.json and Save`);
      console.error(`\nOr attach PutBucketCORS to the IAM user, then re-run:`);
      console.error(`  npx tsx scripts/apply-s3-cors.ts\n`);
      console.error(`AllowedOrigins that must be present:\n  - ${origins.join("\n  - ")}\n`);
    }
    throw err;
  }

  const current = await client.send(new GetBucketCorsCommand({ Bucket: storage.bucket }));
  console.log(`Applied CORS to s3://${storage.bucket}`);
  console.log(`AllowedOrigins: ${origins.join(", ")}`);
  console.log(JSON.stringify(current.CORSRules ?? corsRules, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
