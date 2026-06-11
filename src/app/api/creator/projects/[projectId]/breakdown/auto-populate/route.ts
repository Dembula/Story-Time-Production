import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { executeScriptBreakdown } from "@/lib/modoc/execute-breakdown";

export const maxDuration = 120;

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as { mode?: "full" | "scenes" } | null;
  const mode = body?.mode === "scenes" ? "scenes" : "full";

  const result = await executeScriptBreakdown(projectId, mode);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
  }

  return NextResponse.json({
    ok: true,
    mode,
    warnings: result.warnings,
  });
}
