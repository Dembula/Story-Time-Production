import { ListPartsCommand } from "@aws-sdk/client-s3";
import { createContentMediaS3Client } from "@/lib/content-media-s3";

export type MultipartUploadedPart = {
  PartNumber: number;
  ETag: string;
};

/**
 * Authoritative part list from S3 — avoids depending on browser CORS ExposeHeaders for ETag.
 */
export async function listCompletedMultipartParts(options: {
  key: string;
  uploadId: string;
}): Promise<MultipartUploadedPart[]> {
  const { client, storage } = createContentMediaS3Client();
  const bucket = storage.bucket;
  if (!bucket) {
    throw new Error("Storage bucket is not configured");
  }

  const parts: MultipartUploadedPart[] = [];
  let partNumberMarker: string | undefined;
  let isTruncated = true;

  while (isTruncated) {
    const page = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: options.key,
        UploadId: options.uploadId,
        PartNumberMarker: partNumberMarker,
        MaxParts: 1000,
      }),
    );

    for (const part of page.Parts ?? []) {
      if (!part.PartNumber || !part.ETag) continue;
      parts.push({
        PartNumber: part.PartNumber,
        ETag: part.ETag,
      });
    }

    isTruncated = Boolean(page.IsTruncated);
    partNumberMarker =
      page.NextPartNumberMarker != null ? String(page.NextPartNumberMarker) : undefined;
    if (!isTruncated) break;
  }

  return parts.sort((a, b) => a.PartNumber - b.PartNumber);
}
