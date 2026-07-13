type StorageConfig = {
  bucket: string;
  region: string;
  endpoint: string | null;
  publicBaseUrl: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
};

function clean(value: string | undefined): string | null {
  if (value == null) return null;
  // Strip inline comments and surrounding quotes from env templates
  let trimmed = value.trim();
  if (!trimmed) return null;
  const hash = trimmed.indexOf(" #");
  if (hash >= 0) trimmed = trimmed.slice(0, hash).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (!trimmed || trimmed === '""' || trimmed === "''") return null;
  return trimmed;
}

export function getStorageConfig(): StorageConfig {
  const bucket = clean(process.env.STORAGE_BUCKET_NAME) ?? clean(process.env.S3_BUCKET_NAME) ?? "";
  const region = clean(process.env.STORAGE_REGION) ?? clean(process.env.S3_REGION) ?? "";
  const endpoint = clean(process.env.STORAGE_ENDPOINT) ?? clean(process.env.S3_ENDPOINT);
  const publicBaseUrl = clean(process.env.STORAGE_PUBLIC_BASE_URL) ?? clean(process.env.S3_PUBLIC_BASE_URL);
  const accessKeyId = clean(process.env.STORAGE_ACCESS_KEY_ID) ?? clean(process.env.S3_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.STORAGE_SECRET_ACCESS_KEY) ?? clean(process.env.S3_SECRET_ACCESS_KEY);
  return {
    bucket,
    region,
    endpoint,
    publicBaseUrl,
    accessKeyId,
    secretAccessKey,
  };
}

