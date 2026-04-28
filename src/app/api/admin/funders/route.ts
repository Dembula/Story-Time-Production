import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return { adminId: null as string | null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { adminId: user.id, error: null as NextResponse | null };
}

export async function GET() {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const profiles = await prisma.funderProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      verifications: { orderBy: { submittedAt: "desc" }, take: 20 },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ profiles });
}

export async function PATCH(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const body = (await req.json().catch(() => null)) as
    | {
        funderProfileId?: string;
        status?: "UNDER_REVIEW" | "APPROVED" | "REJECTED";
        note?: string | null;
      }
    | null;

  if (!body?.funderProfileId || !body.status) {
    return NextResponse.json({ error: "funderProfileId and status are required." }, { status: 400 });
  }
  const profile = await prisma.funderProfile.findUnique({ where: { id: body.funderProfileId } });
  if (!profile) return NextResponse.json({ error: "Funder profile not found." }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const profileUpdated = await tx.funderProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: body.status,
        reviewedAt: new Date(),
        approvedForInvestingAt: body.status === "APPROVED" ? new Date() : null,
      },
    });
    await tx.funderVerification.updateMany({
      where: { funderProfileId: profile.id, status: { in: ["PENDING", "UNDER_REVIEW"] } },
      data: {
        status: body.status === "REJECTED" ? "REJECTED" : "APPROVED",
        reviewedById: access.adminId!,
        note: body.note ?? null,
        reviewedAt: new Date(),
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminUserId: access.adminId!,
        action: "FUNDER_VERIFICATION_REVIEW",
        entityType: "FunderProfile",
        entityId: profile.id,
        oldValue: { verificationStatus: profile.verificationStatus },
        newValue: { verificationStatus: body.status, note: body.note ?? null },
      },
    });
    return profileUpdated;
  });

  return NextResponse.json({ profile: updated });
}
