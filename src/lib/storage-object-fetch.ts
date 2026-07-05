import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { guessMimeTypeFromKey, type StorageObjectRef } from "@/lib/storage-object-ref";

export async function getStorageObjectStream(ref: StorageObjectRef) {
  const { client } = createContentMediaS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }),
  );
  if (!response.Body) {
    throw new Error("Empty object body");
  }
  return {
    body: response.Body,
    contentType: response.ContentType || guessMimeTypeFromKey(ref.key),
    contentLength: response.ContentLength ?? null,
  };
}

export async function getStorageObjectSignedUrl(ref: StorageObjectRef, expiresInSeconds = 300) {
  const { client } = createContentMediaS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
