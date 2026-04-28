import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ensureUserRole, replaceUserRoles } from "@/lib/user-roles";
import { hash } from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, bio: true,
      creatorAccountStructure: true,
      creatorTeamSeatCap: true,
      isAfdaStudent: true, createdAt: true, updatedAt: true,
      userRoles: { select: { role: true } },
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
  const { userId, action, newRole, newName, newEmail, newPassword } = body;

  if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 });

  if (action === "CHANGE_ROLE" && newRole) {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
    await ensureUserRole(userId, newRole);
    const updatedRoles = await prisma.userRole.findMany({
      where: { userId },
      select: { role: true },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_ROLE_CHANGE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { role: before.role } : (Prisma.JsonNull as any),
        newValue: { role: updated.role, roles: updatedRoles.map((r) => r.role) },
      },
    });
    return NextResponse.json({ ...updated, userRoles: updatedRoles });
  }

  if (action === "SET_ROLES" && Array.isArray(body.roles)) {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const finalRoles = await replaceUserRoles(userId, body.roles as string[]);
    const primaryRole = newRole && finalRoles.includes(newRole) ? newRole : finalRoles[0];
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: primaryRole } });
    const updatedRoles = finalRoles.map((roleName) => ({ role: roleName }));
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_ROLE_SET",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { role: before.role } : (Prisma.JsonNull as any),
        newValue: { role: updated.role, roles: finalRoles },
      },
    });
    return NextResponse.json({ ...updated, userRoles: updatedRoles });
  }

  if (action === "UPDATE_EMAIL" && typeof newEmail === "string") {
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    const exists = await prisma.user.findFirst({
      where: { email: normalizedEmail, NOT: { id: userId } },
      select: { id: true },
    });
    if (exists) return NextResponse.json({ error: "Email already used by another account." }, { status: 409 });
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const updated = await prisma.user.update({ where: { id: userId }, data: { email: normalizedEmail } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_EMAIL_UPDATE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { email: before.email } : (Prisma.JsonNull as any),
        newValue: { email: updated.email },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "UPDATE_PASSWORD" && typeof newPassword === "string") {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const passwordHash = await hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_PASSWORD_RESET",
        entityType: "User",
        entityId: userId,
        oldValue: Prisma.JsonNull as any,
        newValue: { changedByAdmin: true },
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "UPDATE_CREATOR_ACCOUNT_STRUCTURE") {
    const accountStructure = body.accountStructure === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
    const seatCapRaw = body.teamSeatCap;
    let teamSeatCap: number | null = null;
    if (accountStructure === "COMPANY") {
      const parsed =
        typeof seatCapRaw === "number"
          ? seatCapRaw
          : typeof seatCapRaw === "string"
            ? Number.parseInt(seatCapRaw, 10)
            : NaN;
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
        return NextResponse.json({ error: "Company seat cap must be 1 to 5." }, { status: 400 });
      }
      teamSeatCap = Math.floor(parsed);
    }
    const before = await prisma.user.findUnique({ where: { id: userId } });
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        creatorAccountStructure: accountStructure,
        creatorTeamSeatCap: teamSeatCap,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_CREATOR_ACCOUNT_STRUCTURE_UPDATE",
        entityType: "User",
        entityId: userId,
        oldValue: before
          ? { creatorAccountStructure: before.creatorAccountStructure, creatorTeamSeatCap: before.creatorTeamSeatCap }
          : (Prisma.JsonNull as any),
        newValue: { creatorAccountStructure: updated.creatorAccountStructure, creatorTeamSeatCap: updated.creatorTeamSeatCap },
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
        oldValue: before ? { name: before.name } : (Prisma.JsonNull as any),
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
        oldValue: before ? { email: before.email, role: before.role } : (Prisma.JsonNull as any),
        newValue: Prisma.JsonNull as any,
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
