import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ALLOWED_CONTENT_MEDIA_MIME_TYPES,
  buildUserScopedUploadKey,
  contentMediaMaxUploadBytes,
  resolveContentTypeForUpload,
} from "@/lib/content-media-shared";
import { createContentMediaS3Client } from "@/lib/content-media-s3";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client, storage } = createContentMediaS3Client();
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

    if (!storage.accessKeyId || !storage.secretAccessKey) {
      return NextResponse.json(
        { error: "S3 credentials are required for direct uploads. Set STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY." },
        { status: 500 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      fileName?: string;
      size?: number;
      contentType?: string;
    } | null;

    if (!body || typeof body.fileName !== "string" || !body.fileName.trim()) {
      return NextResponse.json({ error: "Missing or invalid fileName." }, { status: 400 });
    }

    const size = typeof body.size === "number" ? body.size : NaN;
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Missing or invalid size." }, { status: 400 });
    }

    const maxBytes = contentMediaMaxUploadBytes();
    if (size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max size is ${Math.floor(maxBytes / (1024 * 1024))}MB.` },
        { status: 413 },
      );
    }

    const hint = typeof body.contentType === "string" ? body.contentType : "";
    const contentType = resolveContentTypeForUpload({ name: body.fileName, type: hint });

    if (!ALLOWED_CONTENT_MEDIA_MIME_TYPES.has(contentType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Allowed: PDF, Word, plain text, images, video (MP4/MOV/WEBM/MKV/…), audio.",
        },
        { status: 400 },
      );
    }

    const key = buildUserScopedUploadKey(userId, body.fileName.trim());

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 30 });

    return NextResponse.json(
      {
        uploadUrl,
        key,
        contentType,
        headers: {
          "Content-Type": contentType,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Presign error:", err);
    return NextResponse.json({ error: "Could not start upload." }, { status: 500 });
  }
}
