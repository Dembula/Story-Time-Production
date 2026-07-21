import { NextRequest, NextResponse } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { contentMediaKeyBelongsToUser } from "@/lib/content-media-shared";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceUserRateLimit({
      key: "upload-multipart-sign-part",
      userId,
      maxAttempts: 2000,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

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
      partNumber?: number;
    } | null;

    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
    const partNumber = typeof body?.partNumber === "number" ? body.partNumber : NaN;

    if (!key || !uploadId) {
      return NextResponse.json({ error: "Missing key or uploadId." }, { status: 400 });
    }
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      return NextResponse.json({ error: "Invalid partNumber." }, { status: 400 });
    }
    if (!contentMediaKeyBelongsToUser(key, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    // Long-lived enough for large feature masters on slower links.
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 60 * 6 });

    return NextResponse.json({ uploadUrl, partNumber }, { status: 200 });
  } catch (err) {
    console.error("Multipart sign-part error:", err);
    return NextResponse.json({ error: "Could not sign upload part." }, { status: 500 });
  }
}
