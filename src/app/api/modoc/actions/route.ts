import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { ModocActionPayload, ModocActionType } from "@/lib/modoc/actions";
import { MODOC_ACTION_TYPES, normalizeModocActionType } from "@/lib/modoc/action-types";
import { runVaAction } from "@/lib/modoc/run-va-action";
import { CREATOR_VA_ROLE } from "@/lib/modoc/creator-va";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== CREATOR_VA_ROLE) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    payload?: ModocActionPayload;
    conversationId?: string;
    confirmDestructive?: boolean;
    pageContext?: Record<string, string | number | boolean | null>;
    path?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const action = normalizeModocActionType(body.action);
  if (!action) {
    return NextResponse.json(
      {
        error: `Unknown action "${body.action}". Supported: ${MODOC_ACTION_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const payload: ModocActionPayload = { ...(body.payload ?? {}) };
  if (
    action === "submit_support_ticket" ||
    action === "lookup_support_ticket" ||
    action === "list_my_support_tickets"
  ) {
    if (!payload.sourceSurface && body.pageContext?.clientSurface) {
      payload.sourceSurface = String(body.pageContext.clientSurface);
    }
    if (!payload.sourcePath && body.path) {
      payload.sourcePath = body.path;
    }
    if (!payload.toolSlug && body.pageContext?.tool) {
      payload.toolSlug = String(body.pageContext.tool);
    }
    if (!payload.projectId && body.pageContext?.projectId) {
      payload.projectId = String(body.pageContext.projectId);
    }
  }

  const result = await runVaAction({
    userId,
    action,
    payload,
    conversationId: body.conversationId,
    confirmDestructive: body.confirmDestructive === true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, suggest: result.data?.suggest === true, data: result.data },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, message: result.message, data: result.data });
}
