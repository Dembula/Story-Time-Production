import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getConnectionRequestsReceived, getConnectionRequestsSent } from "@/lib/network-db";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [received, sent] = await Promise.all([
    getConnectionRequestsReceived(session.user.id),
    getConnectionRequestsSent(session.user.id),
  ]);

  const fromIds = [...new Set(received.map((r) => r.fromId))];
  const toIds = [...new Set(sent.map((r) => r.toId))];
  const allUserIds = [...new Set([...fromIds, ...toIds])];
  const users =
    allUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, image: true },
        })
      : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return NextResponse.json({
    received: received.map((r) => ({
      ...r,
      from: userMap[r.fromId] ?? { id: r.fromId, name: null, image: null },
    })),
    sent: sent.map((r) => ({
      ...r,
      to: userMap[r.toId] ?? { id: r.toId, name: null, image: null },
    })),
  });
}
