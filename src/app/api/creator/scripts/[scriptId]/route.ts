import { NextRequest, NextResponse } from "next/server";
import { ensureScriptAccess } from "@/lib/script-studio/collaboration-access";

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
