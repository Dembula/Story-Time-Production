import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFollowing, getConnectionStatus, getFollowerCount } from "@/lib/network-db";

const CREATOR_ROLES = [
  "CONTENT_CREATOR",
  "MUSIC_CREATOR",
  "CREW_TEAM",
  "CASTING_AGENCY",
  "LOCATION_OWNER",
  "EQUIPMENT_COMPANY",
  "CATERING_COMPANY",
];

export async function GET() {
  const session = await getServerSession(authOptions);

  const users = await prisma.user.findMany({
    where: { role: { in: CREATOR_ROLES } },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      previousWork: true,
      role: true,
      headline: true,
      location: true,
    },
    orderBy: { createdAt: "desc" },
    take: 48,
  });

  const withExtra = await Promise.all(
    users.map(async (u) => {
      const [following, connectionStatus, followerCount] = await Promise.all([
        session?.user?.id ? isFollowing(session.user.id, u.id) : false,
        session?.user?.id ? getConnectionStatus(session.user.id, u.id) : ("NONE" as const),
        getFollowerCount(u.id),
      ]);
      return {
        ...u,
        headline: u.headline ?? null,
        location: u.location ?? null,
        following,
        connectionStatus,
        followerCount,
      };
    }),
  );

  return NextResponse.json({ creators: withExtra });
}
