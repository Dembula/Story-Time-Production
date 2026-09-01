import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaJsonNull } from "@/lib/prisma-json";
import { ensureUserRole, replaceUserRoles } from "@/lib/user-roles";
import { hash } from "bcryptjs";
import {
  assertAdminTargetMutable,
  isAdminGodAccount,
  parseAdminRights,
  sanitizeAssignedAdminRights,
} from "@/lib/admin-permissions";
import { requireAdminApiPath, actorHasAdminRight } from "@/lib/admin-api-auth";

export async function GET() {
  const actor = await requireAdminApiPath("/api/admin/users");
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, bio: true,
      adminRights: true,
      creatorAccountStructure: true,
      creatorTeamSeatCap: true,
      isAfdaStudent: true, createdAt: true, updatedAt: true,
      userRoles: { select: { role: true } },
      viewerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          plan: true,
          status: true,
          viewerModel: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          lastPaymentStatus: true,
          lastPaymentError: true,
          pastDueSince: true,
        },
      },
      _count: { select: { contents: true, musicTracks: true, watchSessions: true, comments: true, ratings: true, activityLogs: true, equipmentListings: true, locationListings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const payload = users.map((user) => {
    const sub = user.viewerSubscriptions[0];
    return {
      ...user,
      viewerSubscriptions: undefined,
      viewerSubscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            viewerModel: sub.viewerModel,
            trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            lastPaymentStatus: sub.lastPaymentStatus,
            lastPaymentError: sub.lastPaymentError,
            pastDueSince: sub.pastDueSince?.toISOString() ?? null,
          }
        : null,
    };
  });

  return NextResponse.json(payload);
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdminApiPath("/api/admin/users");
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const body = await req.json();
  const { userId, action, newRole, newName, newEmail, newPassword } = body;

  if (!userId || !action) return NextResponse.json({ error: "userId and action required" }, { status: 400 });

  const adminId = actor.id;
  const actorIsGod = actor.isGod;

  if (action === "REVOKE_ADMIN_ACCESS") {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, userRoles: { select: { role: true } } },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    try {
      assertAdminTargetMutable(target.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
    if (!actorIsGod && !actorHasAdminRight(actor, "canManageUsers")) {
      return NextResponse.json({ error: "You do not have permission to revoke admin access." }, { status: 403 });
    }
    const existingRoles = target.userRoles.map((r) => r.role);
    const withoutAdmin = existingRoles.filter((r) => r !== "ADMIN");
    const nextRoles = withoutAdmin.length > 0 ? withoutAdmin : ["SUBSCRIBER"];
    const primaryRole = nextRoles.includes("SUBSCRIBER") ? "SUBSCRIBER" : nextRoles[0];
    await replaceUserRoles(userId, nextRoles);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: primaryRole, adminRights: prismaJsonNull },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "ADMIN_ACCESS_REVOKED",
        entityType: "User",
        entityId: userId,
        oldValue: { role: target.role, roles: existingRoles, email: target.email },
        newValue: { role: updated.role, roles: nextRoles },
      },
    });
    return NextResponse.json({ ...updated, userRoles: nextRoles.map((role) => ({ role })) });
  }

  if (action === "SET_ADMIN_RIGHTS") {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true, adminRights: true } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    try {
      assertAdminTargetMutable(target.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
    if (target.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin rights apply only to ADMIN accounts." }, { status: 400 });
    }
    if (!actorIsGod && !actorHasAdminRight(actor, "canManageUsers")) {
      return NextResponse.json({ error: "You do not have permission to change admin suites." }, { status: 403 });
    }
    const rights = sanitizeAssignedAdminRights(body.adminRights);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { adminRights: rights as object },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "ADMIN_RIGHTS_UPDATE",
        entityType: "User",
        entityId: userId,
        oldValue: target.adminRights ?? prismaJsonNull,
        newValue: rights,
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "CHANGE_ROLE" && newRole) {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    try {
      assertAdminTargetMutable(before?.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
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
        oldValue: before ? { role: before.role } : (prismaJsonNull),
        newValue: { role: updated.role, roles: updatedRoles.map((r) => r.role) },
      },
    });
    return NextResponse.json({ ...updated, userRoles: updatedRoles });
  }

  if (action === "SET_ROLES" && Array.isArray(body.roles)) {
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    try {
      assertAdminTargetMutable(before?.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
    const requestedRoles = body.roles as string[];
    const hadAdmin = before?.role === "ADMIN" || requestedRoles.includes("ADMIN");
    if (!requestedRoles.includes("ADMIN") && hadAdmin) {
      if (!actorIsGod && !actorHasAdminRight(actor, "canManageUsers")) {
        return NextResponse.json({ error: "You do not have permission to remove admin access." }, { status: 403 });
      }
    }
    const finalRoles = await replaceUserRoles(userId, requestedRoles);
    const primaryRole = newRole && finalRoles.includes(newRole) ? newRole : finalRoles[0];
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role: primaryRole,
        ...(!finalRoles.includes("ADMIN") ? { adminRights: prismaJsonNull } : {}),
      },
    });
    const updatedRoles = finalRoles.map((roleName) => ({ role: roleName }));
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_ROLE_SET",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { role: before.role } : (prismaJsonNull),
        newValue: { role: updated.role, roles: finalRoles },
      },
    });
    return NextResponse.json({ ...updated, userRoles: updatedRoles });
  }

  if (action === "UPDATE_EMAIL" && typeof newEmail === "string") {
    const normalizedEmail = newEmail.trim().toLowerCase();
    const before = await prisma.user.findUnique({ where: { id: userId } });
    try {
      assertAdminTargetMutable(before?.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    const exists = await prisma.user.findFirst({
      where: { email: normalizedEmail, NOT: { id: userId } },
      select: { id: true },
    });
    if (exists) return NextResponse.json({ error: "Email already used by another account." }, { status: 409 });
    const updated = await prisma.user.update({ where: { id: userId }, data: { email: normalizedEmail } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_EMAIL_UPDATE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { email: before.email } : (prismaJsonNull),
        newValue: { email: updated.email },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "UPDATE_PASSWORD" && typeof newPassword === "string") {
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    try {
      assertAdminTargetMutable(before?.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
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
        oldValue: prismaJsonNull,
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
          : (prismaJsonNull),
        newValue: { creatorAccountStructure: updated.creatorAccountStructure, creatorTeamSeatCap: updated.creatorTeamSeatCap },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "UPDATE_NAME" && newName !== undefined) {
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    try {
      assertAdminTargetMutable(before?.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
    const updated = await prisma.user.update({ where: { id: userId }, data: { name: newName } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_NAME_UPDATE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { name: before.name } : (prismaJsonNull),
        newValue: { name: updated.name },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "DELETE") {
    const before = await prisma.user.findUnique({ where: { id: userId } });
    try {
      assertAdminTargetMutable(before?.email);
    } catch (err) {
      const status = typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 403;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Forbidden" }, { status });
    }
    await prisma.user.delete({ where: { id: userId } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "USER_DELETE",
        entityType: "User",
        entityId: userId,
        oldValue: before ? { email: before.email, role: before.role } : (prismaJsonNull),
        newValue: prismaJsonNull,
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
