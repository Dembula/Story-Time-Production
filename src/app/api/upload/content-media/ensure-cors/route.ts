import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureStorageBucketCors } from "@/lib/storage-cors";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Heal / verify S3 CORS so browser direct uploads (video, audio, images, PDF)
 * work from story-time.online and preview hosts.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceUserRateLimit({
      key: "upload-ensure-cors",
      userId,
      maxAttempts: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as { force?: boolean } | null;
    const result = await ensureStorageBucketCors({ force: Boolean(body?.force) });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error ||
            "Could not apply storage CORS. An admin must paste deploy/connection-pack/s3-cors.json on the bucket.",
          origins: result.origins,
          bucket: result.bucket,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      applied: result.applied,
      origins: result.origins,
      bucket: result.bucket,
    });
  } catch (err) {
    console.error("[ensure-cors]", err);
    return NextResponse.json({ error: "Could not ensure storage CORS." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await ensureStorageBucketCors({ force: false });
  return NextResponse.json({
    ok: result.ok,
    applied: result.applied,
    origins: result.origins,
    bucket: result.bucket,
    error: result.error ?? null,
  });
}
