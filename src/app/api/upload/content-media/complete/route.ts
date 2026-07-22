import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ALLOWED_CONTENT_MEDIA_MIME_TYPES,
  contentMediaKeyBelongsToUser,
  resolveContentTypeForUpload,
} from "@/lib/content-media-shared";
import {
  buildContentMediaFinalizePayload,
  ingestVideoStreamForContentMedia,
} from "@/lib/content-media-post-upload";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      key?: string;
      contentType?: string;
      fileName?: string;
      durationSeconds?: number;
      estimatedBitrateMbps?: number;
    } | null;

    const key = typeof body?.key === "string" ? body.key.trim() : "";
    if (!key) {
      return NextResponse.json({ error: "Missing key." }, { status: 400 });
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

    const payload = buildContentMediaFinalizePayload({ key, contentType });

    if (contentType.startsWith("video/")) {
      const durationSeconds =
        typeof body?.durationSeconds === "number" && Number.isFinite(body.durationSeconds)
          ? body.durationSeconds
          : null;
      const estimatedBitrateMbps =
        typeof body?.estimatedBitrateMbps === "number" && Number.isFinite(body.estimatedBitrateMbps)
          ? body.estimatedBitrateMbps
          : null;
      after(async () => {
        await ingestVideoStreamForContentMedia({
          sourceUrl: payload.sourceUrl,
          storageRef: payload.storageRef,
          contentType,
          fileNameForMeta: nameHint,
          creatorId: userId,
          durationSeconds,
          estimatedBitrateMbps,
        });
      });
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (err) {
    console.error("Complete upload error:", err);
    return NextResponse.json({ error: "Could not finalize upload." }, { status: 500 });
  }
}
