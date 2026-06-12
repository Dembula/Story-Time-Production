import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ModocActionType } from "@/lib/modoc/actions";
import type { ModocActionPayload } from "@/lib/modoc/action-types";
import { recordModocActionFeedback } from "@/lib/modoc/learning";
import { runVaAction } from "@/lib/modoc/run-va-action";
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
    confirmDestructive?: boolean;
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

  const action = meta.action as ModocActionType | undefined;

  if (!body.accept) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });
    if (action) void recordModocActionFeedback(userId, action, false);
    return NextResponse.json({ ok: true, declined: true });
  }

  if (!action) {
    return NextResponse.json({ error: "No action in suggestion" }, { status: 400 });
  }

  const {
    action: _action,
    scriptTitle,
    versionLabel: _versionLabel,
    followUpAction: _followUpAction,
    url: _url,
    ...actionPayload
  } = meta;

  const result = await runVaAction({
    userId,
    action,
    payload: {
      ...actionPayload,
      projectId: meta.projectId,
      title: meta.title ?? scriptTitle,
    },
    confirmDestructive: body.confirmDestructive === true,
  });

  void recordModocActionFeedback(userId, action, result.ok);

  if (!result.ok) {
    if (result.status === 409 && result.data?.suggest && !body.confirmDestructive) {
      return NextResponse.json(
        {
          error: result.error,
          suggest: true,
          data: result.data,
        },
        { status: 409 },
      );
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });
    await notifyUser({
      userId,
      type: "VA_ACTION_FAILED",
      title: "MODOC action failed",
      body: result.error,
      metadata: { projectId: meta.projectId, action },
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });

  if (meta.followUpAction === "breakdown_full" && meta.projectId) {
    const followUp = await runVaAction({
      userId,
      action: "breakdown_full",
      payload: { projectId: meta.projectId },
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
