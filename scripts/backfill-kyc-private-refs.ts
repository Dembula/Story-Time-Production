import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "../generated/prisma";
import fs from "node:fs";
import path from "node:path";

type StorageConfig = {
  bucket: string;
  region: string;
  endpoint: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
};

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getStorageConfig(): StorageConfig {
  return {
    bucket: clean(process.env.STORAGE_BUCKET_NAME) ?? clean(process.env.S3_BUCKET_NAME) ?? "",
    region: clean(process.env.STORAGE_REGION) ?? clean(process.env.S3_REGION) ?? "",
    endpoint: clean(process.env.STORAGE_ENDPOINT) ?? clean(process.env.S3_ENDPOINT),
    accessKeyId: clean(process.env.STORAGE_ACCESS_KEY_ID) ?? clean(process.env.S3_ACCESS_KEY_ID),
    secretAccessKey: clean(process.env.STORAGE_SECRET_ACCESS_KEY) ?? clean(process.env.S3_SECRET_ACCESS_KEY),
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 250;
  return { apply, limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 250 };
}

function inferExtension(url: string, contentType: string | null): string {
  if (contentType?.includes("pdf")) return "pdf";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  })();
  const fromPath = pathname.split(".").pop()?.toLowerCase();
  if (fromPath && /^[a-z0-9]+$/.test(fromPath)) return fromPath;
  return "bin";
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  const { apply, limit } = parseArgs();
  const storage = getStorageConfig();
  if (!storage.bucket || !storage.region) {
    throw new Error("Missing storage config. Set STORAGE_BUCKET_NAME/STORAGE_REGION (or S3_* equivalents).");
  }

  const prisma = new PrismaClient({ log: ["error"] });
  const s3 = new S3Client({
    region: storage.region,
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

  try {
    const docs = await prisma.funderVerification.findMany({
      where: {
        documentUrl: {
          not: { startsWith: "s3://" },
          notIn: ["", " "],
        },
      },
      orderBy: { submittedAt: "asc" },
      take: limit,
      include: { funderProfile: { select: { userId: true } } },
    });

    if (!docs.length) {
      console.log("No legacy KYC documents found that require backfill.");
      return;
    }

    console.log(`Found ${docs.length} legacy KYC documents. Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
    let updated = 0;
    let failed = 0;

    for (const doc of docs) {
      const current = doc.documentUrl ?? "";
      if (!current || current.startsWith("s3://")) continue;
      if (!/^https?:\/\//i.test(current)) {
        console.warn(`[SKIP] ${doc.id}: unsupported legacy URL format (${current.slice(0, 48)})`);
        continue;
      }
      try {
        const keyPreview = `kyc/funder/${doc.funderProfile.userId}/legacy-backfill/${doc.id}`;
        if (!apply) {
          console.log(`[DRY-RUN] ${doc.id} ${doc.documentType} -> s3://${storage.bucket}/${keyPreview}.*`);
          continue;
        }

        const response = await fetch(current);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        const ext = inferExtension(current, contentType);
        const key = `${keyPreview}.${ext}`;
        const bytes = Buffer.from(await response.arrayBuffer());

        await s3.send(
          new PutObjectCommand({
            Bucket: storage.bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType || "application/octet-stream",
          }),
        );
        const storageRef = `s3://${storage.bucket}/${key}`;
        await prisma.funderVerification.update({
          where: { id: doc.id },
          data: { documentUrl: storageRef },
        });
        await prisma.adminAuditLog.create({
          data: {
            adminUserId: doc.submittedById,
            action: "FUNDER_KYC_DOCUMENT_BACKFILLED",
            entityType: "FunderVerification",
            entityId: doc.id,
            oldValue: { documentUrl: current },
            newValue: { documentUrl: storageRef },
          },
        });
        updated += 1;
        console.log(`[OK] ${doc.id} -> ${storageRef}`);
      } catch (error) {
        failed += 1;
        console.error(`[FAILED] ${doc.id}: ${(error as Error).message}`);
      }
    }

    console.log(
      apply
        ? `Backfill completed. Updated: ${updated}, Failed: ${failed}.`
        : "Dry-run finished. Re-run with --apply to migrate these records.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
