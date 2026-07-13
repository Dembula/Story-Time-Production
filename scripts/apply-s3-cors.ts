/**
 * Apply browser upload CORS to the Storytime media bucket.
 *
 * Requires STORAGE_* / S3_* env vars (same as the app).
 * Usage: npx tsx scripts/apply-s3-cors.ts
 *
 * Direct browser PUTs (poster, backdrop, main video, etc.) need PUT + OPTIONS
 * from your app origin. Without this, XHR uploads fail with a CORS/network error.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { getStorageConfig } from "../src/lib/storage-config";

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

function originsFromEnv(): string[] {
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:3000",
    "https://localhost:3000",
  ]
    .map((v) => (typeof v === "string" ? v.trim().replace(/\/$/, "") : ""))
    .filter(Boolean)
    .filter((v) => {
      try {
        // eslint-disable-next-line no-new
        new URL(v);
        return true;
      } catch {
        return false;
      }
    });

  const extra = (process.env.STORAGE_CORS_ORIGINS || process.env.S3_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return Array.from(new Set([...configured, ...extra]));
}

async function main() {
  const storage = getStorageConfig();
  if (!storage.bucket || !storage.region) {
    throw new Error("Set STORAGE_BUCKET_NAME and STORAGE_REGION (or S3_* equivalents).");
  }
  if (!storage.accessKeyId || !storage.secretAccessKey) {
    throw new Error("Set STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY.");
  }

  const origins = originsFromEnv();
  if (origins.length === 0) {
    throw new Error("No AllowedOrigins resolved. Set NEXT_PUBLIC_APP_URL or STORAGE_CORS_ORIGINS.");
  }

  const client = new S3Client({
    region: storage.region,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
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

  await client.send(
    new PutBucketCorsCommand({
      Bucket: storage.bucket,
      CORSConfiguration: { CORSRules: corsRules },
    }),
  );

  const current = await client.send(new GetBucketCorsCommand({ Bucket: storage.bucket }));
  console.log(`Applied CORS to s3://${storage.bucket}`);
  console.log(`AllowedOrigins: ${origins.join(", ")}`);
  console.log(JSON.stringify(current.CORSRules ?? corsRules, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
