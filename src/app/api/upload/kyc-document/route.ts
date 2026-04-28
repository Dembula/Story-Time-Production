import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorageConfig } from "@/lib/storage-config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 12 * 1024 * 1024;

const storage = getStorageConfig();
const s3Client = new S3Client({
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

function sanitizeExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  return ext.replace(/[^a-z0-9]/g, "") || "bin";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id?: string; role?: string } | undefined;
    if (!user?.id || user.role !== "FUNDER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const bucket = storage.bucket;
    if (!bucket || !storage.region) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field in form-data" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, and PDF are allowed." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File size must be between 1 byte and 12MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = sanitizeExtension(file.name);
    const now = new Date();
    const key = [
      "kyc",
      "funder",
      user.id,
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${now.getTime()}-${Math.random().toString(36).slice(2)}.${ext}`,
    ].join("/");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      }),
    );

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: user.id,
        action: "FUNDER_KYC_DOCUMENT_UPLOAD",
        entityType: "User",
        entityId: user.id,
        oldValue: null as any,
        newValue: { storageRef: `s3://${bucket}/${key}`, mimeType: file.type, size: file.size },
      },
    });

    return NextResponse.json({ ok: true, storageRef: `s3://${bucket}/${key}` }, { status: 201 });
  } catch (error) {
    console.error("KYC upload error", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
