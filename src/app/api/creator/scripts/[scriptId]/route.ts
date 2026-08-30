import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureScriptAccess } from "@/lib/script-studio/collaboration-access";
import { CONFIRM_DELETE_SCRIPT, parseDeleteConfirm } from "@/lib/confirm-delete";

type RouteParams = { params: Promise<{ scriptId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;
  return NextResponse.json({
    script: gate.access.script,
    canWrite: gate.access.canWrite,
    collaborationMode: gate.access.collaborationMode,
  });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;
  if (!gate.access.canWrite) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  const confirmGate = parseDeleteConfirm(body, CONFIRM_DELETE_SCRIPT);
  if (!confirmGate.ok) {
    return NextResponse.json({ error: confirmGate.error }, { status: 400 });
  }

  try {
    await prisma.creatorScript.delete({ where: { id: scriptId } });
  } catch (error) {
    console.error("delete script failed", error);
    return NextResponse.json({ error: "Could not delete script" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: scriptId });
}
