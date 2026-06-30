import { prisma } from "@/lib/prisma";
import { getStorageConfig } from "@/lib/storage-config";
import { getAllowedStorageBaseUrls } from "@/lib/storage-origin";

export type DailiesHealthPayload = {
  ok: boolean;
  storage: {
    configured: boolean;
    bucket: boolean;
    region: boolean;
    publicBaseUrl: boolean;
    credentials: boolean;
    allowedOrigins: number;
  };
  database: {
    dailiesClipTable: boolean;
  };
  stream: {
    configured: boolean;
  };
  issues: string[];
};

export async function checkDailiesHealth(): Promise<DailiesHealthPayload> {
  const storage = getStorageConfig();
  const issues: string[] = [];

  const storageConfigured =
    !!storage.bucket &&
    !!storage.region &&
    (!!storage.publicBaseUrl || (!!storage.accessKeyId && !!storage.secretAccessKey));

  if (!storage.bucket) issues.push("Storage bucket is not configured (STORAGE_BUCKET_NAME or S3_BUCKET_NAME).");
  if (!storage.region) issues.push("Storage region is not configured (STORAGE_REGION or S3_REGION).");
  if (!storage.publicBaseUrl && !(storage.accessKeyId && storage.secretAccessKey)) {
    issues.push("Set STORAGE_PUBLIC_BASE_URL or S3 credentials so uploaded dailies URLs can be validated and played back.");
  }

  const allowedOrigins = getAllowedStorageBaseUrls().length;
  if (allowedOrigins === 0) {
    issues.push("No allowed storage base URLs could be derived from environment variables.");
  }

  let dailiesClipTable = false;
  try {
    await prisma.dailiesClip.count();
    dailiesClipTable = true;
  } catch {
    issues.push("DailiesClip table is missing — run the dailies review studio database migration.");
  }

  const streamConfigured = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
    process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim()
  );

  const ok = storageConfigured && dailiesClipTable && allowedOrigins > 0;

  return {
    ok,
    storage: {
      configured: storageConfigured,
      bucket: !!storage.bucket,
      region: !!storage.region,
      publicBaseUrl: !!storage.publicBaseUrl,
      credentials: !!(storage.accessKeyId && storage.secretAccessKey),
      allowedOrigins,
    },
    database: { dailiesClipTable },
    stream: { configured: streamConfigured },
    issues,
  };
}
