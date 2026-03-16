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
  const adminId = (session?.user as { id?: string })?.id;
  if (role !== "ADMIN" || !adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, action, newRole, newName } = body;

  if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 });

  if (action === "CHANGE_ROLE" && newRole) {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_ROLE_CHANGE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { role: before.role } : null,
        newValue: { role: updated.role },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "UPDATE_NAME" && newName !== undefined) {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const updated = await prisma.user.update({ where: { id: userId }, data: { name: newName } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_NAME_UPDATE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { name: before.name } : null,
        newValue: { name: updated.name },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "DELETE") {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_DELETE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { email: before.email, role: before.role } : null,
        newValue: null,
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
