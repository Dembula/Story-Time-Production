import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { semanticSearchCatalogue } from "@/lib/discovery/semantic-search";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 12)));

    let profileAge: number | null = null;
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const cookieStore = await cookies();
      const profileId = cookieStore.get("st_viewer_profile")?.value;
      if (profileId) {
        const profile = await prisma.viewerProfile.findFirst({
          where: { id: profileId, userId: session.user.id },
          select: { age: true, dateOfBirth: true },
        });
        if (profile) profileAge = getViewerProfileAge(profile);
      }
    }

    const results = await semanticSearchCatalogue({ query: q, limit, profileAge });
    return NextResponse.json({ results, mode: process.env.OPENAI_API_KEY ? "semantic" : "lexical" });
  } catch (err) {
    console.error("semantic-search error:", err);
    return NextResponse.json({ results: [], mode: "error" });
  }
}
