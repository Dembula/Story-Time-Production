import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeModocAction, type ModocActionType } from "@/lib/modoc/actions";
import type { ModocActionPayload } from "@/lib/modoc/action-types";
import { recordModocActionFeedback } from "@/lib/modoc/learning";
import { notifyUser } from "@/lib/notify-user";

type SuggestionMeta = ModocActionPayload & {
  action?: string;
  scriptTitle?: string;
  versionLabel?: string;
  followUpAction?: string;
  url?: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    notificationId?: string;
    accept?: boolean;
  } | null;

  if (!body?.notificationId) {
    return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
  }

  const notification = await prisma.notification.findFirst({
    where: { id: body.notificationId, userId, type: "VA_SUGGESTION" },
  });
  if (!notification) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  let meta: SuggestionMeta = {};
  try {
    meta = JSON.parse(notification.metadata ?? "{}") as SuggestionMeta;
  } catch {
    meta = {};
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });

  const action = meta.action as ModocActionType | undefined;

  if (!body.accept) {
    if (action) void recordModocActionFeedback(userId, action, false);
    return NextResponse.json({ ok: true, declined: true });
  }

  if (!action) {
    return NextResponse.json({ error: "No action in suggestion" }, { status: 400 });
  }

  const result = await executeModocAction(userId, action, {
    projectId: meta.projectId,
    title: meta.title ?? meta.scriptTitle,
    description: meta.description,
    startAt: meta.startAt,
    endAt: meta.endAt,
    department: meta.department,
    priority: meta.priority,
    assigneeId: meta.assigneeId,
  });

  void recordModocActionFeedback(userId, action, true);

  if (!result.ok) {
    await notifyUser({
      userId,
      type: "VA_ACTION_FAILED",
      title: "MODOC action failed",
      body: result.error,
      metadata: { projectId: meta.projectId, action },
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (meta.followUpAction === "breakdown_full" && meta.projectId) {
    const followUp = await executeModocAction(userId, "breakdown_full", {
      projectId: meta.projectId,
    });
    if (followUp.ok) {
      await notifyUser({
        userId,
        type: "VA_ACTION_COMPLETE",
        title: "Script breakdown complete",
        body: followUp.message,
        metadata: {
          projectId: meta.projectId,
          url: meta.url ?? `/creator/projects/${meta.projectId}/pre-production/script-breakdown`,
        },
      });
      return NextResponse.json({
        ok: true,
        message: `${result.message} ${followUp.message}`,
      });
    }
  }

  await notifyUser({
    userId,
    type: "VA_ACTION_COMPLETE",
    title: "MODOC completed your request",
    body: result.message,
    metadata: {
      projectId: meta.projectId,
      url: meta.url,
    },
  });

  return NextResponse.json({ ok: true, message: result.message, data: result.data });
}
