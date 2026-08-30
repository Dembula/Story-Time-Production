import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import { isPexelsConfigured, PexelsApiError } from "@/lib/pexels/client";
import { importPexelsPhotoToStorage } from "@/lib/pexels/import-photo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPexelsConfigured()) {
    return NextResponse.json(
      { error: "Pexels is not configured. Add PEXELS_API_KEY to your environment." },
      { status: 503 },
    );
  }

  const limited = await enforceUserRateLimit({
    key: "pexels-import",
    userId,
    maxAttempts: 40,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as { photoId?: number | string } | null;
  const photoId = Number(body?.photoId);
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return NextResponse.json({ error: "photoId is required" }, { status: 400 });
  }

  try {
    const imported = await importPexelsPhotoToStorage(userId, photoId);
    return NextResponse.json({ asset: imported }, { status: 201 });
  } catch (err) {
    if (err instanceof PexelsApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Pexels import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not import Pexels photo" },
      { status: 502 },
    );
  }
}
