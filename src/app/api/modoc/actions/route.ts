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

  const result = await runVaAction({
    userId,
    action,
    payload: body.payload ?? {},
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
