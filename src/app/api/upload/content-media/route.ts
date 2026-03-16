import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

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

export async function POST(request: NextRequest) {
  try {
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileExt = file.name.split(".").pop() || "bin";
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

    const baseUrl =
      process.env.STORAGE_PUBLIC_BASE_URL ||
      `https://${bucket}.s3.${process.env.STORAGE_REGION}.amazonaws.com`;

    const publicUrl = `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(key)}`;

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
