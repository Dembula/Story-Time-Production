import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, bio: true,
      isAfdaStudent: true, createdAt: true, updatedAt: true,
      _count: { select: { contents: true, musicTracks: true, watchSessions: true, comments: true, ratings: true, activityLogs: true, equipmentListings: true, locationListings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, action, newRole, newName } = body;

  if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 });

  if (action === "CHANGE_ROLE" && newRole) {
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
    return NextResponse.json(updated);
  }

  if (action === "UPDATE_NAME" && newName !== undefined) {
    const updated = await prisma.user.update({ where: { id: userId }, data: { name: newName } });
    return NextResponse.json(updated);
  }

  if (action === "DELETE") {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
