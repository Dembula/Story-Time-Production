import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureUserRole } from "@/lib/user-roles";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applications = await prisma.adminAccessApplication.findMany({
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      note: true,
      requestedAt: true,
      reviewedAt: true,
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(applications);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    id?: string;
    action?: "APPROVE" | "DENY";
    note?: string;
    assignedRights?: Record<string, boolean>;
  };
  const { id, action, note, assignedRights } = body;
  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required." }, { status: 400 });
  }

  const application = await prisma.adminAccessApplication.findUnique({ where: { id } });
  if (!application || application.status !== "PENDING") {
    return NextResponse.json({ error: "Application not found or already reviewed." }, { status: 404 });
  }
  if (!application.passwordHash) {
    return NextResponse.json({ error: "Application cannot be approved (missing credentials)." }, { status: 400 });
  }

  const reviewerId = session.user.id;
  const normalizedEmail = application.email.trim().toLowerCase();

  if (action === "DENY") {
    const updated = await prisma.adminAccessApplication.update({
      where: { id },
      data: {
        status: "DENIED",
        note: note ?? undefined,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        passwordHash: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        note: true,
        requestedAt: true,
        reviewedAt: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(updated);
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, role: true },
  });
  const existingAdminRole = existing
    ? await prisma.userRole.findUnique({
        where: { userId_role: { userId: existing.id, role: "ADMIN" } },
        select: { userId: true },
      })
    : null;
  if (existingAdminRole) {
    return NextResponse.json({ error: "User is already an admin." }, { status: 409 });
  }

  const hash = application.passwordHash;

  const userWrite = existing
    ? prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "ADMIN",
          passwordHash: hash,
          adminRights: assignedRights ?? undefined,
          ...(application.name?.trim() ? { name: application.name.trim() } : {}),
        },
      })
    : prisma.user.create({
        data: {
          email: normalizedEmail,
          name: application.name?.trim() || null,
          passwordHash: hash,
          role: "ADMIN",
          adminRights: assignedRights ?? undefined,
        },
      });

  await prisma.$transaction([
    userWrite,
    prisma.adminAccessApplication.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        passwordHash: null,
      },
    }),
  ]);
  const updatedUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (updatedUser) {
    await ensureUserRole(updatedUser.id, "ADMIN");
  }

  const updated = await prisma.adminAccessApplication.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      note: true,
      requestedAt: true,
      reviewedAt: true,
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(updated);
}
