import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { buildContentMediaFinalizePayload } from "@/lib/content-media-post-upload";
import { resolveContentTypeForUpload, sanitizeExtension } from "@/lib/content-media-shared";
import {
  extractScreenplayFromFileBuffer,
  type ScriptFileExtraction,
} from "@/lib/ai-metadata/extract-script-document";

const MAX_SCRIPT_BYTES = 15 * 1024 * 1024;

export type ScriptImportPersistResult = {
  extraction: ScriptFileExtraction;
  importId: string;
  storageUrl: string | null;
  storageKey: string | null;
};

function resolveScriptImportExtension(fileName: string, mimeType: string, buffer: Buffer): string {
  const fromName = sanitizeExtension(fileName);
  if (fromName !== "bin" && fromName.length <= 8) return fromName;
  if (mimeType.includes("pdf") || buffer.slice(0, 5).toString() === "%PDF-") return "pdf";
  if (mimeType.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx")) return "docx";
  if (mimeType.includes("opendocument.text") || fileName.toLowerCase().endsWith(".odt")) return "odt";
  if (mimeType.includes("rtf") || fileName.toLowerCase().endsWith(".rtf")) return "rtf";
  if (fileName.toLowerCase().endsWith(".fdx")) return "fdx";
  if (fileName.toLowerCase().endsWith(".fountain")) return "fountain";
  return fromName || "bin";
}

function buildScriptImportKey(userId: string, fileName: string, mimeType: string, buffer: Buffer): string {
  const ext = resolveScriptImportExtension(fileName, mimeType, buffer);
  const now = new Date();
  const safeStem = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
    .replace(/^-|-$/g, "") || "screenplay";
  return [
    "scripts",
    "imports",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    userId,
    `${now.getTime()}-${safeStem}.${ext}`,
  ].join("/");
}

async function uploadScriptImportToStorage(
  userId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ storageKey: string | null; storageUrl: string | null }> {
  try {
    const { client, storage } = createContentMediaS3Client();
    if (!storage.bucket || !storage.accessKeyId || !storage.secretAccessKey) {
      return { storageKey: null, storageUrl: null };
    }

    const contentType = resolveContentTypeForUpload({ name: fileName, type: mimeType });
    const key = buildScriptImportKey(userId, fileName, contentType, buffer);

    await client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const payload = buildContentMediaFinalizePayload({ key, contentType });
    return { storageKey: key, storageUrl: payload.publicUrl };
  } catch (err) {
    console.error("Script import storage upload failed:", err);
    return { storageKey: null, storageUrl: null };
  }
}

async function assertScriptOwnership(scriptId: string | null | undefined, userId: string): Promise<boolean> {
  if (!scriptId) return true;
  const script = await prisma.creatorScript.findFirst({
    where: { id: scriptId, userId },
    select: { id: true },
  });
  return Boolean(script);
}

export async function persistScriptImport(input: {
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  scriptId?: string | null;
  projectId?: string | null;
}): Promise<ScriptImportPersistResult> {
  if (input.buffer.byteLength === 0 || input.buffer.byteLength > MAX_SCRIPT_BYTES) {
    throw new Error("Invalid script file size.");
  }

  const ownsScript = await assertScriptOwnership(input.scriptId, input.userId);
  if (!ownsScript) {
    throw new Error("Script not found.");
  }

  const [storage, extraction] = await Promise.all([
    uploadScriptImportToStorage(input.userId, input.buffer, input.fileName, input.mimeType),
    extractScreenplayFromFileBuffer(input.buffer, input.fileName, input.mimeType),
  ]);

  const status = extraction.text.trim() && !extraction.error ? "success" : "failed";

  let importId = `local-${Date.now()}`;

  try {
    const record = await prisma.creatorScriptImport.create({
      data: {
        userId: input.userId,
        scriptId: input.scriptId || null,
        projectId: input.projectId || null,
        originalFileName: input.fileName,
        mimeType: input.mimeType || null,
        fileSizeBytes: input.buffer.byteLength,
        storageKey: storage.storageKey,
        storageUrl: storage.storageUrl,
        sourceType: extraction.sourceType,
        extractionMethod: extraction.extractionMethod ?? null,
        extractedChars: extraction.text.length || null,
        status,
        errorMessage: extraction.error ?? (status === "failed" ? "No readable screenplay text found." : null),
      },
    });
    importId = record.id;

    if (input.scriptId && status === "success") {
      const script = await prisma.creatorScript.findUnique({
        where: { id: input.scriptId },
        select: { studioMeta: true },
      });
      const studioMeta =
        script?.studioMeta && typeof script.studioMeta === "object" && !Array.isArray(script.studioMeta)
          ? { ...(script.studioMeta as Record<string, unknown>) }
          : {};
      await prisma.creatorScript.update({
        where: { id: input.scriptId },
        data: {
          studioMeta: {
            ...studioMeta,
            lastImportId: record.id,
            lastImportUrl: storage.storageUrl,
            lastImportFileName: input.fileName,
            lastImportAt: new Date().toISOString(),
          },
        },
      });
    }
  } catch (err) {
    console.error("CreatorScriptImport persist failed (run prisma migrate deploy):", err);
  }

  return {
    extraction,
    importId,
    storageUrl: storage.storageUrl,
    storageKey: storage.storageKey,
  };
}
