import { NextRequest, NextResponse } from "next/server";
import { ensureScriptAccess } from "@/lib/script-studio/collaboration-access";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ scriptId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;

  const versions = await prisma.creatorScriptVersion.findMany({
    where: { scriptId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      createdBy: {
        select: { id: true, name: true, professionalName: true },
      },
    },
  });

  return NextResponse.json({ versions });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;
  if (!gate.access.canWrite) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    versionLabel?: string;
    content?: string;
  } | null;

  const content = body?.content ?? gate.access.script.content;
  const version = await prisma.creatorScriptVersion.create({
    data: {
      scriptId,
      versionLabel: body?.versionLabel?.trim() || `Draft ${new Date().toLocaleString()}`,
      content,
      createdById: gate.access.userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, professionalName: true },
      },
    },
  });

  return NextResponse.json({ version }, { status: 201 });
}
