import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeModocAction, type ModocActionPayload, type ModocActionType } from "@/lib/modoc/actions";
import { recordModocActionFeedback } from "@/lib/modoc/learning";
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
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const action = body.action as ModocActionType;

  const result = await executeModocAction(userId, action, body.payload ?? {});

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  void recordModocActionFeedback(userId, action, true);

  return NextResponse.json({ ok: true, message: result.message, data: result.data });
}
