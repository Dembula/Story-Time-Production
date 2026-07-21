import { NextRequest, NextResponse } from "next/server";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { contentMediaKeyBelongsToUser } from "@/lib/content-media-shared";
import { createContentMediaS3Client } from "@/lib/content-media-s3";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client, storage } = createContentMediaS3Client();
    const bucket = storage.bucket;
    if (!bucket) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
    }

    const body = (await request.json().catch(() => null)) as {
      key?: string;
      uploadId?: string;
    } | null;

    const key = typeof body?.key === "string" ? body.key.trim() : "";
    const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
    if (!key || !uploadId) {
      return NextResponse.json({ error: "Missing key or uploadId." }, { status: 400 });
    }
    if (!contentMediaKeyBelongsToUser(key, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Multipart abort error:", err);
    return NextResponse.json({ error: "Could not abort multipart upload." }, { status: 500 });
  }
}
