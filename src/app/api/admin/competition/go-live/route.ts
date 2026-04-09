import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendTransactionalEmail } from "@/lib/email";
import { buildAppUrl } from "@/lib/app-url";

const COMPETITION_NOTIFICATION_TYPE = "COMPETITION_LIVE";

function isCatalogueCreatorRole(role: string): boolean {
  return role === "CONTENT_CREATOR";
}

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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        userPreference: { select: { notifyEmail: true } },
      },
    });

    const endFormatted = endDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const compUrl = "/browse/competition";
    const metadataJson = JSON.stringify({ url: compUrl });

    const viewerTitle = "Viewer Choice competition is live";
    const viewerBody = `Vote for your favourite creator. Voting is open for ${durationDays} day${durationDays === 1 ? "" : "s"} (until ${endFormatted}). The winner receives a Story Time Original.`;

    const creatorTitle = "Competition is live — rally your audience";
    const creatorBody = `Viewer Choice is open for ${durationDays} day${durationDays === 1 ? "" : "s"} (until ${endFormatted}). Share your profile and ask fans to vote — the winner receives a Story Time Original.`;

    const notifRows: { userId: string; type: string; title: string; body: string; metadata: string }[] = [];
    for (const u of users) {
      const creator = isCatalogueCreatorRole(u.role);
      notifRows.push({
        userId: u.id,
        type: COMPETITION_NOTIFICATION_TYPE,
        title: creator ? creatorTitle : viewerTitle,
        body: creator ? creatorBody : viewerBody,
        metadata: metadataJson,
      });
    }

    if (notifRows.length > 0) {
      await prisma.notification.createMany({ data: notifRows });
    }

    const emailTasks: Promise<boolean>[] = [];
    const absUrl = buildAppUrl(compUrl);
    for (const u of users) {
      if (!u.email) continue;
      const prefOff = u.userPreference?.notifyEmail === false;
      if (prefOff) continue;
      const creator = isCatalogueCreatorRole(u.role);
      const subject = creator ? creatorTitle : viewerTitle;
      const text = `${creator ? creatorBody : viewerBody}\n\n${absUrl}`;
      emailTasks.push(sendTransactionalEmail({ to: u.email, subject, text }));
    }
    await Promise.allSettled(emailTasks);

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: "COMPETITION_GO_LIVE",
        entityType: "CompetitionPeriod",
        entityId: period.id,
        oldValue: Prisma.JsonNull as any,
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
      notificationsSent: notifRows.length,
      emailsAttempted: emailTasks.length,
    });
  } catch (e) {
    console.error("Competition go-live error:", e);
    return NextResponse.json(
      { error: "Failed to start competition or send notifications" },
      { status: 500 },
    );
  }
}
