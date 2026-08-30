import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { buildContentMediaFinalizePayload } from "@/lib/content-media-post-upload";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { buildUserScopedUploadKey } from "@/lib/content-media-shared";
import {
  formatPexelsCredit,
  getPexelsPhoto,
  isAllowedPexelsImageUrl,
  pickPexelsDownloadUrl,
  type PexelsPhoto,
} from "@/lib/pexels/client";

export type ImportedPexelsPhoto = {
  storageUrl: string;
  storageRef: string;
  title: string;
  caption: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
  pexelsId: number;
  previewUrl: string;
};

function extensionFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("avif")) return "avif";
  return "jpg";
}

export async function importPexelsPhotoToStorage(
  userId: string,
  photoId: number,
): Promise<ImportedPexelsPhoto> {
  const photo = await getPexelsPhoto(photoId);
  return persistPexelsPhoto(userId, photo);
}

async function persistPexelsPhoto(userId: string, photo: PexelsPhoto): Promise<ImportedPexelsPhoto> {
  const downloadUrl = pickPexelsDownloadUrl(photo);
  if (!isAllowedPexelsImageUrl(downloadUrl)) {
    throw new Error("Unexpected Pexels image host.");
  }

  const imageRes = await fetch(downloadUrl, {
    headers: { Accept: "image/*" },
    next: { revalidate: 0 },
  });
  if (!imageRes.ok) {
    throw new Error(`Could not download Pexels image (${imageRes.status}).`);
  }

  const contentType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new Error("Pexels returned a non-image payload.");
  }

  const buffer = Buffer.from(await imageRes.arrayBuffer());
  if (buffer.byteLength < 32) {
    throw new Error("Downloaded Pexels image was empty.");
  }

  const { client, storage } = createContentMediaS3Client();
  const bucket = storage.bucket;
  if (!bucket || !storage.region) {
    throw new Error("Storage is not configured.");
  }

  const ext = extensionFromContentType(contentType);
  const fileName = `pexels-${photo.id}.${ext}`;
  const key = buildUserScopedUploadKey(userId, fileName);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const payload = buildContentMediaFinalizePayload({ key, contentType });
  const title = (photo.alt || "").trim() || `Pexels ${photo.id}`;
  const caption = formatPexelsCredit(photo);

  return {
    storageUrl: payload.sourceUrl,
    storageRef: payload.storageRef,
    title,
    caption,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    pexelsUrl: photo.url,
    pexelsId: photo.id,
    previewUrl: photo.src.medium || photo.src.small,
  };
}
