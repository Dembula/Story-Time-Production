import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoryTimeOriginalBadge } from "@/lib/storytime-original";
import { packAdminContentMediaFields } from "@/lib/admin-content-media-pack";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") {
    where.reviewStatus = status;
  }

  const content = await prisma.content.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, email: true, isAfdaStudent: true } },
      linkedProject: {
        select: {
          id: true,
          title: true,
          pitches: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, title: true } },
        },
      },
      _count: { select: { watchSessions: true, ratings: true, comments: true, crewMembers: true, btsVideos: true, subtitles: true } },
      crewMembers: { select: { name: true, role: true }, take: 20 },
      btsVideos: { select: { id: true, title: true, videoUrl: true, thumbnail: true }, orderBy: { sortOrder: "asc" } },
      subtitles: { select: { id: true, language: true, label: true, vttUrl: true, isDefault: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const enriched = await Promise.all(
    content.map(async (item) => {
      const latestPitch = item.linkedProject?.pitches[0] ?? null;
      const originalBadge = getStoryTimeOriginalBadge(latestPitch);
      const packed = await packAdminContentMediaFields(item);
      return {
        ...packed,
        linkedProject: item.linkedProject
          ? {
              id: item.linkedProject.id,
              title: item.linkedProject.title,
              originalBadge,
              latestPitchStatus: latestPitch?.status ?? null,
            }
          : null,
      };
    }),
  );

  return NextResponse.json(enriched);
}
