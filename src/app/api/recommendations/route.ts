import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getViewerRecommendations } from "@/lib/viewer-recommendations";
import { getHybridRecommendations } from "@/lib/recommendations/hybrid-recommendations";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json([]);
    }

    let profileAge: number | null = null;
    let viewerProfileId: string | null = null;
    const cookieStore = await cookies();
    const profileId = cookieStore.get("st_viewer_profile")?.value;
    if (profileId) {
      const profile = await prisma.viewerProfile.findFirst({
        where: { id: profileId, userId },
        select: { id: true, age: true, dateOfBirth: true },
      });
      if (profile) {
        profileAge = getViewerProfileAge(profile);
        viewerProfileId = profile.id;
      }
    }

    const useHybrid = process.env.AI_HYBRID_RECOMMENDATIONS !== "false";
    const recommendations = useHybrid
      ? await getHybridRecommendations({
          userId,
          viewerProfileId,
          profileAge,
          limit: 12,
        })
      : await getViewerRecommendations({
          userId,
          viewerProfileId,
          profileAge,
          limit: 12,
        });

    return NextResponse.json(
      recommendations.map(({ recScore: _s, avgRating: _a, ...c }) => ({
        ...c,
        posterUrl: getDisplayPosterUrl(c) ?? c.posterUrl,
      })),
    );
  } catch (err) {
    console.error("Recommendations API error:", err);
    return NextResponse.json([]);
  }
}
