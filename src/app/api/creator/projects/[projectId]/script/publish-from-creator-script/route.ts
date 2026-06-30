import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { publishCreatorScriptToProject } from "@/lib/project-script-sync";

/** Copy a linked CreatorScript into the canonical ProjectScript and refresh ProjectScene rows. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as { creatorScriptId?: string } | null;
  if (!body?.creatorScriptId) {
    return NextResponse.json({ error: "Missing creatorScriptId" }, { status: 400 });
  }

  const result = await publishCreatorScriptToProject({
    projectId,
    creatorScriptId: body.creatorScriptId,
    userId,
  });
  if (!result) {
    return NextResponse.json({ error: "Script not found for this project" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...result });
}
