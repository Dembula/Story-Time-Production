import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureUserRole } from "@/lib/user-roles";
import { requireAdminApiPath } from "@/lib/admin-api-auth";
import { sanitizeAssignedAdminRights } from "@/lib/admin-permissions";

export async function GET(req: NextRequest) {
  const actor = await requireAdminApiPath("/api/admin/requests");
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDING | APPROVED | DENIED | all

  const where = status && status !== "all" ? { status } : {};

  const requests = await prisma.adminRequest.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    include: {
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role === "ADMIN") return NextResponse.json({ error: "Admins cannot submit requests" }, { status: 400 });

  const existing = await prisma.adminRequest.findFirst({
    where: { requestedById: session.user.id, status: "PENDING" },
  });
  if (existing) return NextResponse.json({ error: "You already have a pending admin request" }, { status: 400 });

  const created = await prisma.adminRequest.create({
    data: { requestedById: session.user.id, status: "PENDING" },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdminApiPath("/api/admin/requests");
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const body = await req.json();
  const { id, action, assignedRights, note } = body as {
    id: string;
    action: "APPROVE" | "DENY";
    assignedRights?: Record<string, boolean>;
    note?: string;
  };

  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const adminRequest = await prisma.adminRequest.findUnique({ where: { id } });
  if (!adminRequest || adminRequest.status !== "PENDING")
    return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });

  const reviewerId = actor.id;
  const parsedRights = sanitizeAssignedAdminRights(assignedRights ?? {});

  if (action === "APPROVE") {
    await prisma.$transaction([
      prisma.adminRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          assignedRights: parsedRights,
        },
      }),
      prisma.user.update({
        where: { id: adminRequest.requestedById },
        data: {
          role: "ADMIN",
          adminRights: parsedRights,
        },
      }),
    ]);
    await ensureUserRole(adminRequest.requestedById, "ADMIN");
  } else {
    await prisma.adminRequest.update({
      where: { id },
      data: {
        status: "DENIED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        note: note ?? undefined,
      },
    });
  }

  const updated = await prisma.adminRequest.findUnique({
    where: { id },
    include: {
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(updated);
}
