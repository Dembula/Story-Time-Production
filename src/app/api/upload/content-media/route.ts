import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ALLOWED_CONTENT_MEDIA_MIME_TYPES,
  buildUserScopedUploadKey,
  contentMediaMaxUploadBytes,
  resolveContentTypeForUpload,
} from "@/lib/content-media-shared";
import { finalizeContentMediaUpload } from "@/lib/content-media-post-upload";
import { createContentMediaS3Client } from "@/lib/content-media-s3";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client: s3Client, storage } = createContentMediaS3Client();
    const bucket = storage.bucket;

    if (!bucket || !storage.region) {
      return NextResponse.json(
        {
          error:
            "Storage is not configured. Set STORAGE_BUCKET_NAME/STORAGE_REGION (or S3_BUCKET_NAME/S3_REGION).",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field in form-data" }, { status: 400 });
    }

    const contentType = resolveContentTypeForUpload(file);

    if (!ALLOWED_CONTENT_MEDIA_MIME_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Allowed: PDF, Word (.doc/.docx), plain text, images (JPG/PNG/WEBP/AVIF/GIF/HEIC/HEIF), video (MP4/MOV/WEBM/MKV/MPEG/AVI/WMV/M4V/HEVC), audio (MP3/WAV/FLAC/AAC/OGG).",
        },
        { status: 400 },
      );
    }

    const maxBytes = contentMediaMaxUploadBytes();
    if (file.size <= 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File too large. Max size is ${Math.floor(maxBytes / (1024 * 1024))}MB.`,
        },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const key = buildUserScopedUploadKey(userId, file.name);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const payload = await finalizeContentMediaUpload({
      key,
      contentType,
      fileNameForMeta: file.name,
    });

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
