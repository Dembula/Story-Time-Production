import { S3Client } from "@aws-sdk/client-s3";
import { getStorageConfig } from "@/lib/storage-config";

export function createContentMediaS3Client(): {
  client: S3Client;
  storage: ReturnType<typeof getStorageConfig>;
} {
  const storage = getStorageConfig();
  const client = new S3Client({
    region: storage.region || undefined,
    endpoint: storage.endpoint || undefined,
    credentials:
      storage.accessKeyId && storage.secretAccessKey
        ? {
            accessKeyId: storage.accessKeyId,
            secretAccessKey: storage.secretAccessKey,
          }
        : undefined,
    forcePathStyle: Boolean(storage.endpoint),
  });
  return { client, storage };
}
