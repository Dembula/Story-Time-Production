import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPlaybackBundleData,
  PlaybackBundleError,
} from "@/lib/playback-bundle";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episodeId = req.nextUrl.searchParams.get("episodeId")?.trim() || null;
    const isTrailer = req.nextUrl.searchParams.get("trailer") === "1";
    const session = await getServerSession(authOptions);
    const bundle = await getPlaybackBundleData({
      contentId: id,
      episodeId,
      isTrailer,
      auth: {
        userId: session?.user?.id,
        role: (session?.user as { role?: string } | undefined)?.role ?? null,
        profileId: req.cookies.get("st_viewer_profile")?.value ?? null,
      },
    });

    return NextResponse.json(
      bundle,
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    if (err instanceof PlaybackBundleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("playback-bundle error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
