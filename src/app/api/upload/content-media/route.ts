import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const DEFAULT_MAX_UPLOAD_MB = 200;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
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

const s3Client = new S3Client({
  region: process.env.STORAGE_REGION,
  endpoint: process.env.STORAGE_ENDPOINT || undefined,
  credentials: process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
      }
    : undefined,
  forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT),
});

function maxUploadBytes(): number {
  const parsed = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB);
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_MB;
  return Math.floor(mb * 1024 * 1024);
}

function normalizePublicBaseUrl(bucket: string): string {
  const raw = process.env.STORAGE_PUBLIC_BASE_URL?.trim();
  const fallback = `https://${bucket}.s3.${process.env.STORAGE_REGION}.amazonaws.com`;
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
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bucket = process.env.STORAGE_BUCKET_NAME;

    if (!bucket || !process.env.STORAGE_REGION) {
      return NextResponse.json(
        { error: "Storage is not configured. Please set STORAGE_BUCKET_NAME and STORAGE_REGION env vars." },
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
            "Unsupported file type. Allowed: PDF, Word (.doc/.docx), plain text, images (JPG/PNG/WEBP/AVIF/GIF), video (MP4/WEBM/MOV/MKV), audio (MP3/WAV/FLAC/AAC/OGG).",
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
        {
          error: `File too large. Max size is ${Math.floor(maxBytes / (1024 * 1024))}MB.`,
        },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileExt = sanitizeExtension(file.name);
    const now = new Date();
    const key = [
      "uploads",
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

    return NextResponse.json(
      {
        ok: true,
        bucket,
        path: key,
        publicUrl,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
