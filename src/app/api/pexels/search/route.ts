import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enforceUserRateLimit } from "@/lib/api-rate-limit";
import {
  isPexelsConfigured,
  PexelsApiError,
  searchPexelsPhotos,
} from "@/lib/pexels/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
    key: "pexels-search",
    userId,
    maxAttempts: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { searchParams } = req.nextUrl;
  const query = (searchParams.get("query") || "").trim();
  const page = Number(searchParams.get("page") || "1");
  const perPage = Number(searchParams.get("perPage") || "24");
  const orientation = searchParams.get("orientation");

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const data = await searchPexelsPhotos({
      query,
      page: Number.isFinite(page) ? page : 1,
      perPage: Number.isFinite(perPage) ? perPage : 24,
      orientation:
        orientation === "landscape" || orientation === "portrait" || orientation === "square"
          ? orientation
          : undefined,
    });

    return NextResponse.json({
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      nextPage: data.next_page ? data.page + 1 : null,
      photos: data.photos.map((p) => ({
        id: p.id,
        width: p.width,
        height: p.height,
        url: p.url,
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        alt: p.alt,
        avgColor: p.avg_color,
        src: {
          tiny: p.src.tiny,
          small: p.src.small,
          medium: p.src.medium,
          large: p.src.large,
          large2x: p.src.large2x,
        },
      })),
      attribution: {
        provider: "Pexels",
        providerUrl: "https://www.pexels.com",
        notice: "Photos provided by Pexels",
      },
    });
  } catch (err) {
    if (err instanceof PexelsApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Pexels search error:", err);
    return NextResponse.json({ error: "Pexels search failed" }, { status: 502 });
  }
}
