import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client, type CORSRule } from "@aws-sdk/client-s3";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { getStorageConfig } from "@/lib/storage-config";

/** Origins that must always be allowed — independent of local/.env NEXTAUTH_URL. */
export const CANONICAL_STORAGE_CORS_ORIGINS = [
  "https://story-time.online",
  "https://www.story-time.online",
  "https://story-time-production.vercel.app",
] as const;

const ENSURE_CACHE_MS = 10 * 60 * 1000;

export type EnsureStorageCorsResult = {
  ok: boolean;
  applied: boolean;
  bucket: string | null;
  origins: string[];
  error?: string;
  rules?: CORSRule[];
};

let cachedAt = 0;
let cachedResult: EnsureStorageCorsResult | null = null;
let inFlight: Promise<EnsureStorageCorsResult> | null = null;

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

/** Resolve AllowedOrigins for browser→storage PUTs (catalogue masters, posters, PDFs, etc.). */
export function resolveStorageCorsOrigins(): string[] {
  const configured = [
    ...CANONICAL_STORAGE_CORS_ORIGINS,
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

function buildCorsRules(origins: string[]): CORSRule[] {
  return [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "HEAD", "PUT", "POST", "DELETE"],
      AllowedOrigins: origins,
      ExposeHeaders: [
        "ETag",
        "etag",
        "x-amz-request-id",
        "x-amz-id-2",
        "x-amz-version-id",
        "x-amz-server-side-encryption",
      ],
      MaxAgeSeconds: 3000,
    },
  ];
}

function corsLooksComplete(rules: CORSRule[] | undefined, requiredOrigins: string[]): boolean {
  if (!rules || rules.length === 0) return false;
  const origins = new Set(
    rules.flatMap((r) => (r.AllowedOrigins ?? []).map((o) => normalizeOrigin(o))),
  );
  if (origins.has("*")) {
    // Wildcard cannot be combined with credentialed requests; treat as incomplete for PUT uploads.
    return false;
  }
  for (const must of requiredOrigins) {
    if (!origins.has(normalizeOrigin(must))) return false;
  }
  const methods = new Set(
    rules.flatMap((r) => (r.AllowedMethods ?? []).map((m) => m.toUpperCase())),
  );
  if (!methods.has("PUT") || !methods.has("GET")) return false;
  const exposed = new Set(
    rules.flatMap((r) => (r.ExposeHeaders ?? []).map((h) => h.toLowerCase())),
  );
  if (!exposed.has("etag")) return false;
  return true;
}

function createCorsManagementClient(): ReturnType<typeof createContentMediaS3Client> {
  const storage = getStorageConfig();
  const adminKey = process.env.STORAGE_ADMIN_ACCESS_KEY_ID?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim();
  const adminSecret =
    process.env.STORAGE_ADMIN_SECRET_ACCESS_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (adminKey && adminSecret) {
    const client = new S3Client({
      region: storage.region || undefined,
      endpoint: storage.endpoint || undefined,
      credentials: {
        accessKeyId: adminKey,
        secretAccessKey: adminSecret,
      },
      forcePathStyle: Boolean(storage.endpoint),
    });
    return { client, storage };
  }

  return createContentMediaS3Client();
}

/**
 * Ensure the media bucket allows browser PUT/OPTIONS from production app origins.
 * Safe to call on every upload start — cached and idempotent.
 * Requires s3:PutBucketCORS / s3:GetBucketCORS (see iam-policy-storytime-uploader.json).
 */
export async function ensureStorageBucketCors(options?: {
  force?: boolean;
}): Promise<EnsureStorageCorsResult> {
  const force = Boolean(options?.force);
  if (!force && cachedResult?.ok && Date.now() - cachedAt < ENSURE_CACHE_MS) {
    return { ...cachedResult, applied: false };
  }
  if (!force && inFlight) return inFlight;

  inFlight = (async (): Promise<EnsureStorageCorsResult> => {
    const origins = resolveStorageCorsOrigins();
    const { client, storage } = createCorsManagementClient();
    const bucket = storage.bucket || null;

    if (!bucket || !storage.region) {
      return {
        ok: false,
        applied: false,
        bucket,
        origins,
        error: "Storage bucket is not configured.",
      };
    }
    const hasUploaderCreds = Boolean(storage.accessKeyId && storage.secretAccessKey);
    const hasAdminCreds = Boolean(
      (process.env.STORAGE_ADMIN_ACCESS_KEY_ID?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim()) &&
        (process.env.STORAGE_ADMIN_SECRET_ACCESS_KEY?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim()),
    );
    if (!hasUploaderCreds && !hasAdminCreds) {
      return {
        ok: false,
        applied: false,
        bucket,
        origins,
        error: "Storage credentials are not configured.",
      };
    }

    let currentRules: CORSRule[] | undefined;
    let getDenied = false;
    try {
      const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
      currentRules = current.CORSRules;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // NoSuchCORSConfiguration → treat as empty and apply below.
      if (/AccessDenied|not authorized|ExplicitDeny/i.test(message)) {
        getDenied = true;
        console.warn("[storage-cors] GetBucketCors denied — will attempt PutBucketCORS:", message);
      } else if (!/NoSuchCORSConfiguration|The CORS configuration does not exist/i.test(message)) {
        console.warn("[storage-cors] GetBucketCors:", message);
      }
      currentRules = undefined;
    }

    if (!force && corsLooksComplete(currentRules, [...CANONICAL_STORAGE_CORS_ORIGINS])) {
      const result: EnsureStorageCorsResult = {
        ok: true,
        applied: false,
        bucket,
        origins,
        rules: currentRules,
      };
      cachedAt = Date.now();
      cachedResult = result;
      return result;
    }

    try {
      const rules = buildCorsRules(origins);
      await client.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: { CORSRules: rules },
        }),
      );
      let verifiedRules: CORSRule[] | undefined = rules;
      try {
        const verified = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
        verifiedRules = verified.CORSRules ?? rules;
      } catch {
        // Put succeeded; Get may still be denied on least-privilege keys.
      }
      const result: EnsureStorageCorsResult = {
        ok: true,
        applied: true,
        bucket,
        origins,
        rules: verifiedRules,
      };
      cachedAt = Date.now();
      cachedResult = result;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[storage-cors] PutBucketCors failed:", message);
      // If we cannot read or write CORS, assume existing config may still work for uploads.
      if (getDenied && /AccessDenied|not authorized|ExplicitDeny/i.test(message) && !force) {
        const optimistic: EnsureStorageCorsResult = {
          ok: true,
          applied: false,
          bucket,
          origins,
          error: `Could not verify/update CORS (${message}). Proceeding; browser upload will surface a clear error if CORS is wrong.`,
          rules: currentRules,
        };
        return optimistic;
      }
      return {
        ok: false,
        applied: false,
        bucket,
        origins,
        error: message,
        rules: currentRules,
      };
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
