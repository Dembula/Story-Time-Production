import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFollowing, getConnectionStatus, getFollowerCount } from "@/lib/network-db";
import { enrichNetworkUserRow } from "@/lib/network-display-name";

const CREATOR_ROLES = [
  "CONTENT_CREATOR",
  "MUSIC_CREATOR",
  "CREW_TEAM",
  "CASTING_AGENCY",
  "LOCATION_OWNER",
  "EQUIPMENT_COMPANY",
  "CATERING_COMPANY",
];

const CREATOR_SELECT = {
  id: true,
  name: true,
  email: true,
  networkHandle: true,
  image: true,
  bio: true,
  previousWork: true,
  role: true,
  headline: true,
  location: true,
} as const;

function buildSearchWhere(q: string) {
  const term = q.trim();
  if (!term) return { role: { in: CREATOR_ROLES } };

  const normalizedHandle = term.replace(/^@+/, "").toLowerCase();
  return {
    role: { in: CREATOR_ROLES },
    OR: [
      { networkHandle: { contains: normalizedHandle, mode: "insensitive" as const } },
      { name: { contains: term, mode: "insensitive" as const } },
      { headline: { contains: term, mode: "insensitive" as const } },
      { email: { contains: term.toLowerCase(), mode: "insensitive" as const } },
    ],
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const searching = q.length > 0;

  const users = await prisma.user.findMany({
    where: buildSearchWhere(q),
    select: CREATOR_SELECT,
    orderBy: searching ? { name: "asc" } : { createdAt: "desc" },
    take: searching ? 60 : 48,
  });

  const withExtra = await Promise.all(
    users.map(async (u) => {
      const [following, connectionStatus, followerCount] = await Promise.all([
        session?.user?.id ? isFollowing(session.user.id, u.id) : false,
        session?.user?.id ? getConnectionStatus(session.user.id, u.id) : ("NONE" as const),
        getFollowerCount(u.id),
      ]);
      return enrichNetworkUserRow({
        ...u,
        headline: u.headline ?? null,
        location: u.location ?? null,
        following,
        connectionStatus,
        followerCount,
      });
    }),
  );

  return NextResponse.json({ creators: withExtra });
}
