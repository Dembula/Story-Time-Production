import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const COMPETITION_NOTIFICATION_TYPE = "COMPETITION_LIVE";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const adminId = (session?.user as { id?: string })?.id;
  if (role !== "ADMIN" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    name?: string;
    durationDays?: number;
  } | null;

  const name = (body?.name ?? "Viewer Choice").trim() || "Viewer Choice";
  const durationDays = Math.min(365, Math.max(1, Number(body?.durationDays) || 7));

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + durationDays);

  try {
    // Close any existing OPEN period so only one is live at a time
    await prisma.competitionPeriod.updateMany({
      where: { status: "OPEN" },
      data: { status: "CLOSED" },
    });

    const period = await prisma.competitionPeriod.create({
      data: {
        name,
        startDate: now,
        endDate,
        status: "OPEN",
      },
    });

    const userIds = await prisma.user.findMany({
      select: { id: true },
    });

    const endFormatted = endDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const title = "Viewer Choice Competition is live";
    const bodyText = `Vote for your favourite creator! The Viewer Choice competition lets you connect directly with creators and help them get great opportunities. Voting is open for ${durationDays} day${durationDays === 1 ? "" : "s"} (until ${endFormatted}). The winner receives a Story Time Original.`;
    const metadata = JSON.stringify({ url: "/browse/competition" });

    if (userIds.length > 0) {
      await prisma.notification.createMany({
        data: userIds.map((u) => ({
          userId: u.id,
          type: COMPETITION_NOTIFICATION_TYPE,
          title,
          body: bodyText,
          metadata,
        })),
      });
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "COMPETITION_GO_LIVE",
        entityType: "CompetitionPeriod",
        entityId: period.id,
        oldValue: Prisma.JsonNull,
        newValue: {
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          status: period.status,
        },
      },
    });

    return NextResponse.json({
      success: true,
      period: {
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
      },
      notificationsSent: userIds.length,
    });
  } catch (e) {
    console.error("Competition go-live error:", e);
    return NextResponse.json(
      { error: "Failed to start competition or send notifications" },
      { status: 500 }
    );
  }
}
