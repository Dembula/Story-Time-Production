import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorageConfig } from "@/lib/storage-config";
import { prisma } from "@/lib/prisma";
import { requiresPayoutKyc } from "@/lib/payout-kyc";
import { registerFunderKycUpload, registerPayoutKycUpload } from "@/lib/kyc-verification-sync";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 12 * 1024 * 1024;

function resolveKycContentType(file: Pick<File, "name" | "type">): string {
  const raw = (file.type || "").trim().toLowerCase();
  if (raw && ALLOWED_MIME_TYPES.has(raw)) return raw;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return raw || "application/octet-stream";
}

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
    const canUpload = user?.id && (user.role === "FUNDER" || user.role === "ADMIN" || requiresPayoutKyc(user.role));
    if (!canUpload) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const bucket = storage.bucket;
    if (!bucket || !storage.region) {
      return NextResponse.json(
        {
          error:
            "Document storage is not configured on this server. Set STORAGE_BUCKET_NAME and STORAGE_REGION (or S3_* equivalents) in your environment.",
        },
        { status: 503 },
      );
    }
    if (!storage.accessKeyId || !storage.secretAccessKey) {
      return NextResponse.json(
        { error: "Storage credentials are missing. Set STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const rawDocType = formData.get("documentType");
    const documentType = typeof rawDocType === "string" ? rawDocType.trim() : "";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field in form-data" }, { status: 400 });
    }
    const contentType = resolveKycContentType(file);
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Only JPG, PNG, and PDF are allowed." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File size must be between 1 byte and 12MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = sanitizeExtension(file.name);
    const now = new Date();
    const vaultSegment = user.role === "FUNDER" ? "funder" : "payout";
    const key = [
      "kyc",
      vaultSegment,
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
        ContentType: contentType,
      }),
    );

    const storageRef = `s3://${bucket}/${key}`;

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: user.id!,
        action: vaultSegment === "funder" ? "FUNDER_KYC_DOCUMENT_UPLOAD" : "PAYOUT_KYC_DOCUMENT_UPLOAD",
        entityType: "User",
        entityId: user.id!,
        oldValue: null as any,
        newValue: { storageRef, mimeType: contentType, size: file.size, documentType: documentType || null },
      },
    });

    if (documentType) {
      if (user.role === "FUNDER") {
        await registerFunderKycUpload(user.id!, documentType, storageRef);
      } else if (requiresPayoutKyc(user.role)) {
        await registerPayoutKycUpload(user.id!, user.role!, documentType, storageRef);
      }
    }

    return NextResponse.json({ ok: true, storageRef, documentType: documentType || null }, { status: 201 });
  } catch (error) {
    console.error("KYC upload error", error);
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
