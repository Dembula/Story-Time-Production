import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { contentMediaKeyBelongsToUser } from "@/lib/content-media-shared";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Deletes a user-owned content-media object from storage.
 * Accepts storageRef (s3://…), public URL, or raw key.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceUserRateLimit({
      key: "upload-content-media-delete",
      userId,
      maxAttempts: 180,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as {
      storageRef?: string;
      url?: string;
      key?: string;
    } | null;

    const raw =
      (typeof body?.storageRef === "string" && body.storageRef.trim()) ||
      (typeof body?.url === "string" && body.url.trim()) ||
      (typeof body?.key === "string" && body.key.trim()) ||
      "";

    if (!raw) {
      return NextResponse.json({ error: "Missing storageRef, url, or key." }, { status: 400 });
    }

    let key = "";
    let bucket: string | undefined;

    if (!raw.includes("://") && raw.startsWith("uploads/")) {
      key = raw;
    } else {
      const resolved = resolveStorageObjectRef(raw);
      if (!resolved) {
        return NextResponse.json({ error: "Unrecognized storage reference." }, { status: 400 });
      }
      key = resolved.key;
      bucket = resolved.bucket;
    }

    if (!contentMediaKeyBelongsToUser(key, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { client, storage } = createContentMediaS3Client();
    const targetBucket = bucket || storage.bucket;
    if (!targetBucket) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: key,
      }),
    );

    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error("[content-media/delete]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete file" },
      { status: 500 },
    );
  }
}
