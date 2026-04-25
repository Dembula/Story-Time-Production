import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorageConfig } from "@/lib/storage-config";

export const runtime = "nodejs";

const DEFAULT_MAX_MB = 25;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "video/3gpp",
  "video/3gpp2",
  "video/avi",
  "video/hevc",
  "video/h265",
  "video/mpeg",
  "video/mp2t",
  "video/x-m4v",
  "video/x-msvideo",
  "video/x-ms-wmv",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
]);

const storage = getStorageConfig();

const s3Client = new S3Client({
  region: storage.region || undefined,
  endpoint: storage.endpoint || undefined,
  credentials: storage.accessKeyId && storage.secretAccessKey
    ? {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      }
    : undefined,
  forcePathStyle: Boolean(storage.endpoint),
});

function maxUploadBytes(): number {
  const parsed = Number(process.env.ACCOUNT_UPLOAD_MAX_FILE_SIZE_MB);
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_MB;
  return Math.floor(mb * 1024 * 1024);
}

function normalizePublicBaseUrl(bucket: string): string {
  const raw = storage.publicBaseUrl;
  const fallback = `https://${bucket}.s3.${storage.region}.amazonaws.com`;
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

function sanitizeExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  return ext.replace(/[^a-z0-9]/g, "") || "bin";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bucket = storage.bucket;
    if (!bucket || !storage.region) {
      return NextResponse.json(
        { error: "Storage is not configured. Set STORAGE_BUCKET_NAME/STORAGE_REGION (or S3_BUCKET_NAME/S3_REGION)." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field in form-data" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Allowed: PDF, Word (.doc/.docx), plain text, images (JPG/PNG/WEBP/GIF/AVIF/HEIC/HEIF), video (MP4/MOV/WEBM/MKV/MPEG/AVI/WMV/M4V/HEVC), and common audio formats.",
        },
        { status: 400 },
      );
    }

    const maxBytes = maxUploadBytes();
    if (file.size <= 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max size is ${Math.floor(maxBytes / (1024 * 1024))}MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = sanitizeExtension(file.name);
    const now = new Date();
    const key = [
      "account-compliance",
      userId,
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${now.getTime()}-${Math.random().toString(36).slice(2)}.${fileExt}`,
    ].join("/");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    const baseUrl = normalizePublicBaseUrl(bucket);
    const publicUrl = `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;

    return NextResponse.json({ ok: true, bucket, path: key, publicUrl }, { status: 201 });
  } catch (err) {
    console.error("Account document upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
