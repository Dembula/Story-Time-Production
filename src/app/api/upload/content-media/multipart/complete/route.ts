import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ALLOWED_CONTENT_MEDIA_MIME_TYPES,
  contentMediaKeyBelongsToUser,
  resolveContentTypeForUpload,
} from "@/lib/content-media-shared";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { listCompletedMultipartParts } from "@/lib/content-media-multipart";
import {
  buildContentMediaFinalizePayload,
  ingestVideoStreamForContentMedia,
} from "@/lib/content-media-post-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

type CompletedPart = { PartNumber: number; ETag: string };

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
      return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
    }
    if (!storage.accessKeyId || !storage.secretAccessKey) {
      return NextResponse.json({ error: "S3 credentials are required for direct uploads." }, { status: 500 });
    }

    const body = (await request.json().catch(() => null)) as {
      key?: string;
      uploadId?: string;
      contentType?: string;
      fileName?: string;
      parts?: CompletedPart[];
      expectedPartCount?: number;
    } | null;

    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
    if (!key || !uploadId) {
      return NextResponse.json({ error: "Missing key or uploadId." }, { status: 400 });
    }
    if (!contentMediaKeyBelongsToUser(key, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nameHint = typeof body?.fileName === "string" ? body.fileName : key.split("/").pop() ?? "file";
    const typeHint = typeof body?.contentType === "string" ? body.contentType : "";
    const contentType = resolveContentTypeForUpload({ name: nameHint, type: typeHint });
    if (!ALLOWED_CONTENT_MEDIA_MIME_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported content type." }, { status: 400 });
    }

    // Prefer server ListParts so browser CORS ExposeHeaders(ETag) is not required.
    let parts: CompletedPart[] = [];
    try {
      parts = await listCompletedMultipartParts({ key, uploadId });
    } catch (listErr) {
      console.error("ListParts failed; falling back to client-provided parts:", listErr);
      const rawParts = Array.isArray(body?.parts) ? body.parts : [];
      parts = rawParts
        .map((p) => ({
          PartNumber: Number(p?.PartNumber),
          ETag: typeof p?.ETag === "string" ? p.ETag.trim() : "",
        }))
        .filter((p) => Number.isInteger(p.PartNumber) && p.PartNumber >= 1 && p.ETag.length > 0)
        .sort((a, b) => a.PartNumber - b.PartNumber);
    }

    if (parts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No uploaded parts found. The browser→S3 multipart PUT likely failed (CORS). Apply deploy/connection-pack/s3-cors.json (PUT + ExposeHeaders ETag) and retry.",
        },
        { status: 400 },
      );
    }

    const expected =
      typeof body?.expectedPartCount === "number" && Number.isFinite(body.expectedPartCount)
        ? Math.floor(body.expectedPartCount)
        : null;
    if (expected != null && expected > 0 && parts.length < expected) {
      return NextResponse.json(
        {
          error: `Incomplete multipart upload (${parts.length}/${expected} parts). Check S3 CORS allows PUT from this site origin, then retry.`,
        },
        { status: 409 },
      );
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({
            PartNumber: p.PartNumber,
            ETag: p.ETag,
          })),
        },
      }),
    );

    const payload = buildContentMediaFinalizePayload({ key, contentType });

    if (contentType.startsWith("video/")) {
      after(async () => {
        await ingestVideoStreamForContentMedia({
          sourceUrl: payload.sourceUrl,
          storageRef: payload.storageRef,
          contentType,
          fileNameForMeta: nameHint,
          creatorId: userId,
        });
      });
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    console.error("Multipart complete error:", err);
    return NextResponse.json({ error: "Could not finalize multipart upload." }, { status: 500 });
  }
}
